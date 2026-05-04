/**
 * PROJ-20 Phase 3.4 — useNicheChipSync
 *
 * Auto-prefills the SmartTextarea with a niche-context chip whenever the
 * Niche-Detail tab in the MultiPurposeDrawer has an active niche
 * (`s.chatBar.activeNicheId`). The hook is purely an effect coordinator —
 * it owns no render, just imperative side-effects on the SmartTextarea
 * via the supplied ref.
 *
 * Acceptance criteria covered:
 *  - AC-15: chip is auto-prefilled when drawer-niche becomes active.
 *           User-removal disables auto-prefill for the rest of the session.
 *  - AC-18: switching the active niche while a chip exists swaps the chip
 *           AND fires a notistack toast `Context: {Niche Name}`.
 *  - EC-4 : if the niche behind an active chip is deleted (404 / not found
 *           in the niche list query), the chip is removed and a toast
 *           `Niche '{name}' was deleted — context cleared` is shown. Redux
 *           is then cleared via `setActiveNicheId(null)`.
 *
 * Session reset:
 *  - When `activeSessionId` changes, the local `autoPrefillDisabled` flag
 *    is reset so the new session can again auto-prefill.
 *
 * Manual chip removal detection:
 *  - The hook subscribes to the canonical `inputChip` Redux state. When the
 *    chip transitions from non-null → null while the drawer still has an
 *    active niche, it concludes the user removed it manually and locks
 *    auto-prefill for the rest of this session.
 *
 * Idempotency note (Bug 1/2):
 *  - `useTranslation()` and `useSnackbar()` return new `t` / `enqueueSnackbar`
 *    references on every render in some environments (notably tests). Without
 *    guarding, the auto-prefill effect would re-insert the same chip on every
 *    re-render of any unrelated parent state (e.g. `setInputChip`). We track
 *    `lastInsertedNicheIdRef` to make insertion idempotent: if the same niche
 *    is already the auto-prefill target and the user hasn't disabled the flag,
 *    we no-op.
 *
 * Re-render hook (Bug 3 / EC-4):
 *  - RTK Query state lives in `nicheApi`'s reducer slice. When that state
 *    changes (e.g. a query 404s), the slice notifies its subscribers via the
 *    standard Redux dispatch mechanism. To make sure this hook reacts to
 *    those changes even when none of the chatBar-scoped selectors changed,
 *    we subscribe directly to the store with `useSyncExternalStore` and a
 *    monotonic tick. Each store dispatch advances the tick → re-render →
 *    re-evaluation of `useGetNicheQuery` and the error effect.
 */
import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useStore } from 'react-redux';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setActiveNicheId } from '@/store/chatBarSlice';
import { useGetNicheQuery } from '@/store/nicheSlice';
import type { SmartTextareaHandle } from '../SmartTextarea';

export interface UseNicheChipSyncArgs {
  smartTextareaRef: RefObject<SmartTextareaHandle | null>;
}

export const useNicheChipSync = ({ smartTextareaRef }: UseNicheChipSyncArgs): void => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const store = useStore();

  // Force a re-render on every store dispatch so RTK Query state changes
  // (e.g. niche 404 errors that live in `nicheApi`'s slice) propagate to
  // this hook even if our chatBar-scoped selectors didn't change.
  const tickRef = useRef(0);
  useSyncExternalStore(
    (cb) =>
      store.subscribe(() => {
        tickRef.current += 1;
        cb();
      }),
    () => tickRef.current,
  );

  const activeNicheId = useAppSelector((s) => s.chatBar.activeNicheId);
  const activeSessionId = useAppSelector((s) => s.chatBar.activeSessionId);
  const inputChip = useAppSelector((s) => s.chatBar.inputChip);

  // Skip the query when there is no active niche — RTK Query's `skip`
  // option short-circuits the request and returns `data: undefined`.
  const {
    data: niche,
    isError,
    isLoading,
  } = useGetNicheQuery(activeNicheId ?? '', {
    skip: !activeNicheId,
  });

  // Session-scoped flag. Once the user manually removes the chip we stop
  // auto-prefilling for this session. Reset whenever `activeSessionId`
  // changes (new session = fresh start).
  const autoPrefillDisabledRef = useRef<boolean>(false);
  // Track previous values so we can detect transitions in effects.
  const prevInputChipIdRef = useRef<string | null>(inputChip?.niche_id ?? null);
  const prevSessionIdRef = useRef<string | null>(activeSessionId);
  // Track the last `activeNicheId` we processed in the auto-prefill effect.
  // This is a TRANSITION marker — separate from `lastInsertedNicheIdRef`
  // which tracks what we actually inserted into the DOM. We use it to skip
  // the effect body when no real activeNicheId change occurred (the effect
  // can re-fire on unstable deps such as `t` / `enqueueSnackbar`).
  const seenActiveNicheIdRef = useRef<string | null>(activeNicheId);
  // Track the niche-id we last auto-inserted so swap-toast logic knows
  // whether this is the first prefill (no toast) or a swap (toast).
  const lastInsertedNicheIdRef = useRef<string | null>(null);
  // Keep the last known niche name so we can show it in the
  // "niche deleted" toast even after the niche query 404s.
  const lastKnownNameRef = useRef<string | null>(niche?.name ?? null);

  // ----- Reset autoPrefillDisabled on session change -----
  useEffect(() => {
    if (prevSessionIdRef.current !== activeSessionId) {
      autoPrefillDisabledRef.current = false;
      prevSessionIdRef.current = activeSessionId;
      // A new session starts with whatever `activeNicheId` is currently in
      // place. We don't want auto-prefill to retroactively insert a chip
      // for an already-set niche just because the flag was reset — only
      // FUTURE `activeNicheId` changes should trigger inserts. So we mark
      // the current niche as already "seen" + "inserted" (the swap
      // bookkeeping). The actual chip on screen is whatever the previous
      // session left there; the user is free to dispatch a niche change
      // to get a fresh prefill.
      seenActiveNicheIdRef.current = activeNicheId;
      if (activeNicheId !== null) {
        lastInsertedNicheIdRef.current = activeNicheId;
      }
    }
  }, [activeSessionId, activeNicheId]);

  // ----- Detect manual chip removal -----
  // When inputChip transitions non-null → null while activeNicheId is still
  // set, the user removed it (the only other code path that nulls inputChip
  // is our own removeChip below, but that path also sets autoPrefillDisabled
  // beforehand so it's idempotent here).
  useEffect(() => {
    const prevId = prevInputChipIdRef.current;
    const currentId = inputChip?.niche_id ?? null;
    if (prevId !== null && currentId === null && activeNicheId !== null) {
      autoPrefillDisabledRef.current = true;
      // Also forget the last-inserted id so the auto-prefill effect can't
      // accidentally re-insert later in the same session.
      lastInsertedNicheIdRef.current = null;
    }
    prevInputChipIdRef.current = currentId;
  }, [inputChip, activeNicheId]);

  // ----- Auto-prefill / swap on activeNicheId change -----
  useEffect(() => {
    const handle = smartTextareaRef.current;
    if (!handle) {
      // Defer: the parent likely hasn't mounted SmartTextarea yet.
      return;
    }

    // SHORT-CIRCUIT: auto-prefill is locked for this session.
    if (autoPrefillDisabledRef.current) {
      // Keep the transition marker fresh so when the flag is later reset
      // (e.g. on session change) we don't re-insert for a niche we already
      // saw while the flag was set.
      seenActiveNicheIdRef.current = activeNicheId;
      return;
    }

    // Niche cleared → if our chip matches, remove it. No toast.
    if (activeNicheId === null) {
      const currentChip = handle.getValue().chip;
      if (currentChip) {
        handle.removeChip();
      }
      lastKnownNameRef.current = null;
      lastInsertedNicheIdRef.current = null;
      seenActiveNicheIdRef.current = null;
      return;
    }

    // Wait for niche data to load. We re-run on `niche` changes below.
    if (isLoading || !niche) {
      return;
    }

    // Idempotent guard: if we've already processed this exact `activeNicheId`
    // in this effect, no-op. Prevents duplicate inserts when the effect
    // re-fires due to unstable deps such as `t` / `enqueueSnackbar` or due
    // to the session-reset flag flipping.
    if (
      seenActiveNicheIdRef.current === activeNicheId &&
      lastInsertedNicheIdRef.current === activeNicheId
    ) {
      lastKnownNameRef.current = niche.name;
      return;
    }

    // Swap toast fires only when we already had a chip on screen and we're
    // replacing it with a different niche. First-ever prefill = no toast.
    const isSwap =
      lastInsertedNicheIdRef.current !== null &&
      lastInsertedNicheIdRef.current !== activeNicheId;
    handle.insertChip({ niche_id: niche.id, niche_name: niche.name });
    lastInsertedNicheIdRef.current = niche.id;
    lastKnownNameRef.current = niche.name;
    seenActiveNicheIdRef.current = activeNicheId;

    if (isSwap) {
      enqueueSnackbar(
        t('search.chatBar.contextUpdated', { name: niche.name }),
        { variant: 'info' },
      );
    }
    // We deliberately depend on both `activeNicheId` and `niche` so the
    // initial prefill (mount with active niche, niche data still loading)
    // fires once `niche` resolves.
  }, [activeNicheId, niche, isLoading, smartTextareaRef, enqueueSnackbar, t]);

  // ----- EC-4: niche deletion handling -----
  useEffect(() => {
    if (!isError) return;
    if (!activeNicheId) return;
    const handle = smartTextareaRef.current;
    if (!handle) return;
    const name = lastKnownNameRef.current ?? '';
    handle.removeChip();
    enqueueSnackbar(
      t('search.chatBar.contextDeleted', { name }),
      { variant: 'warning' },
    );
    // Clear Redux to fully detach. setInputChip flushing happens via the
    // textarea onValueChange wiring in ChatInputBar.
    dispatch(setActiveNicheId(null));
    lastKnownNameRef.current = null;
    lastInsertedNicheIdRef.current = null;
  }, [isError, activeNicheId, smartTextareaRef, dispatch, enqueueSnackbar, t]);
};
