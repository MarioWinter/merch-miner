import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import {
  useAiImproveListingMutation,
  useGetMbaProductCatalogQuery,
  useGetProductConfigQuery,
  useUpdateListingMutation,
  useUpdateProductConfigMutation,
} from '@/store/publishSlice';
import { useAppSelector } from '@/store/hooks';
import type {
  Listing,
  ListingColorMode,
  ListingKeywords,
  ListingLanguage,
  ListingTypeFlag,
  MarketplaceType,
  PrintSide,
  ProductConfigEntry,
  UpdateProductConfigBody,
} from '../types';
import { royaltyFor as computeRoyalty } from './royaltyFor';
import { buildPublishEditQueueKey } from './editQueueStorage';
import { useOfflineQueue, type QueueFailureAction } from './useOfflineQueue';

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export type TextField =
  | 'brand_name'
  | 'title'
  | 'bullet_1'
  | 'bullet_2'
  | 'description'
  | 'keyword_context';

/**
 * Subset of TextField that exists on `ListingTranslation` (per-language
 * copy). Brand is global across languages, keyword_context is AI input and
 * per AC-9 not translated. Only the 4 copy fields get per-locale storage.
 */
export type TranslatableField = 'title' | 'bullet_1' | 'bullet_2' | 'description';

export const TRANSLATABLE_FIELDS: readonly TranslatableField[] = [
  'title',
  'bullet_1',
  'bullet_2',
  'description',
];

export interface EditFormStateArgs {
  designId: string | null;
  marketplaceType: MarketplaceType;
  listingId: string | null;
  /** Current server-side Listing (drives on-blur-if-dirty diff). */
  listing: Listing | null;
}

interface EntryPatch {
  enabled?: boolean;
  fit_types?: string[];
  print_side?: PrintSide;
  colors?: string[];
  marketplaces?: ProductConfigEntry['marketplaces'];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRICE_DEBOUNCE_MS = 400;

const TEXT_FIELDS: readonly TextField[] = [
  'brand_name',
  'title',
  'bullet_1',
  'bullet_2',
  'description',
  'keyword_context',
];

// Serializable queue payloads — localStorage-friendly (no closures).
type QueuePayload =
  | {
      kind: 'updateProductConfig';
      designId: string;
      body: UpdateProductConfigBody;
    }
  | {
      kind: 'updateListing';
      id: string;
      body: Partial<Listing>;
    };

/**
 * RTK Query errors have `{ status, data }`. Numeric statuses 400..499 are
 * non-transient (validation, auth, not-found) — retrying won't help, so
 * drop the op. Everything else (5xx, `'FETCH_ERROR'`, `'TIMEOUT_ERROR'`,
 * unknown) is treated as transient → retry on next `online` tick.
 */
const classifyQueueError = (err: unknown): QueueFailureAction => {
  const status = (err as { status?: unknown })?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return 'drop';
  }
  return 'retry';
};

/**
 * Phase O5 — canonical per-key identifier for concurrency chains.
 * Product-config PATCHes chain per `(designId, marketplace_type)` pair;
 * listing PATCHes chain per `listing_id`. Keys from the two buckets never
 * collide (different prefixes).
 */
const patchKeyOf = (payload: QueuePayload): string => {
  if (payload.kind === 'updateProductConfig') {
    return `pc:${payload.designId}:${payload.body.marketplace_type}`;
  }
  return `l:${payload.id}`;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * PROJ-11 Phase O2 — state layer for the Edit Page auto-save hybrid.
 *
 * Splits field mutations into three behavioural buckets:
 *  - **controlSetters** fire immediately (toggles, radios, swatches).
 *  - **priceSetters** debounce 400ms per (product, marketplace).
 *  - **textSetters** PATCH on-blur-if-dirty (partial body, one field).
 *
 * Exposes `manualSave()`, `discard()`, `aiImprove()`, plus `focusedProduct`
 * state (drives which product entry is active in the per-product config
 * sections) and `royaltyFor(...)` pure helper.
 *
 * Legacy 1200ms blanket debounce (see `useProductConfig`) is superseded by
 * this hook — both paths coexist until Phase P rewrites the components.
 */
export const useEditFormState = ({
  designId,
  marketplaceType,
  listingId,
  listing,
}: EditFormStateArgs) => {
  const [updateProductConfig, { isLoading: isSavingConfig, error: configError }] =
    useUpdateProductConfigMutation();
  const [updateListing, { isLoading: isSavingListing, error: listingError }] =
    useUpdateListingMutation();
  const [aiImproveListing, { isLoading: isImproving, error: improveError }] =
    useAiImproveListingMutation();
  const { data: catalog } = useGetMbaProductCatalogQuery();

  // ---- Phase O4: offline PATCH queue -----------------------------------
  // Every PATCH goes through `enqueue(payload)`. Payloads are serializable
  // (so the queue persists through page reloads via localStorage). Online
  // → `enqueue` flushes immediately; offline → payloads buffer FIFO until
  // the next `online` event. Executor failure keeps the op at head for
  // retry on the next flush.
  //
  // Scoping: storage key is derived from the active user + workspace. If
  // either is missing (unauthenticated bootstrap, no workspace loaded),
  // the key is `null` and the queue runs ref-only (no persist). This
  // prevents cross-user leakage on shared machines.
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const workspaceId = useAppSelector(
    (state) => state.workspace.activeWorkspaceId,
  );
  const queueStorageKey = useMemo(
    () => buildPublishEditQueueKey(userId, workspaceId),
    [userId, workspaceId],
  );

  // ---- Phase O5: per-key promise-chain serialization (EC-38) -----------
  // Guarantees that two PATCHes targeting the same (design, marketplace)
  // product-config row — or the same listing_id — are awaited in-order,
  // so the later PATCH's `.unwrap()` can never race the earlier one.
  // The O4 offline queue already FIFOs globally during flush; the chain
  // layers per-key ordering as an explicit, payload-shape-aware guarantee
  // and keeps the semantic stable if any future caller ever bypasses the
  // queue and reaches the executor directly.
  const perKeyChainsRef = useRef<Map<string, Promise<unknown>>>(new Map());

  const queueExecutor = useCallback(
    (payload: QueuePayload) => {
      const key = patchKeyOf(payload);
      const prev = perKeyChainsRef.current.get(key) ?? Promise.resolve();
      // `.catch` on the chain itself so a single rejection doesn't poison
      // later ops in the same bucket. The returned `next` still rejects
      // for the caller + offline-queue classifier.
      const next = prev
        .catch(() => undefined)
        .then((): Promise<unknown> => {
          if (payload.kind === 'updateProductConfig') {
            return updateProductConfig({
              designId: payload.designId,
              body: payload.body,
            }).unwrap();
          }
          return updateListing({
            id: payload.id,
            body: payload.body,
          }).unwrap();
        });
      // Stored tail swallows rejections so the *next* op's `.catch` line
      // above still sees a settled promise. Cleanup runs when this op
      // becomes the tail and settles — prevents unbounded Map growth.
      const stored = next.catch(() => undefined);
      perKeyChainsRef.current.set(key, stored);
      void stored.then(() => {
        if (perKeyChainsRef.current.get(key) === stored) {
          perKeyChainsRef.current.delete(key);
        }
      });
      return next;
    },
    [updateProductConfig, updateListing],
  );
  const { isOnline, queueLength, enqueue } = useOfflineQueue<QueuePayload>({
    storageKey: queueStorageKey,
    executor: queueExecutor,
    classifyError: classifyQueueError,
  });

  // ---- focusedProduct state --------------------------------------------
  // Two derived behaviours (both applied during render, guarded by equality
  // checks so React doesn't loop — same pattern as `useSavedToast` in
  // UnsavedChangesBanner):
  //  1. `(designId, marketplaceType)` change → clear focus so we never
  //     carry a stale product key into the new context.
  //  2. When focus is null and the config has at least one enabled entry →
  //     auto-focus the first enabled product so the per-product sections
  //     (Fit/Print/Colors/Pricing) have something to render without a user
  //     click.
  const [focusedProduct, setFocusedProduct] = useState<string | null>(null);
  const [focusScope, setFocusScope] = useState<string>(
    `${designId ?? 'none'}|${marketplaceType}`,
  );

  const { data: productConfigForFocus } = useGetProductConfigQuery(
    designId
      ? { designId, marketplace_type: marketplaceType }
      : skipToken,
  );

  const currentScope = `${designId ?? 'none'}|${marketplaceType}`;
  if (focusScope !== currentScope) {
    setFocusScope(currentScope);
    if (focusedProduct !== null) setFocusedProduct(null);
  }
  if (focusedProduct === null) {
    const firstEnabledKey = productConfigForFocus?.products_config?.find(
      (e) => e.enabled,
    )?.product_type;
    if (firstEnabledKey) setFocusedProduct(firstEnabledKey);
  }

  // ---- Pending dirty tracker (text + price) ----------------------------
  // Price debouncers keyed by `${productKey}::${marketplace}`. Text blur
  // hasn't committed yet -> tracked in `dirtyTextRef`.
  const priceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const pendingPricePatchRef = useRef<
    Map<string, { productKey: string; marketplace: string; price: number }>
  >(new Map());
  const dirtyTextRef = useRef<Map<TextField, string>>(new Map());

  // Snapshot of the latest products_config — read during debounced PATCHes
  // so single-marketplace updates can be MERGED into the full marketplaces
  // array. The backend applies a shallow merge at entry level, so sending
  // only a one-item marketplaces array would wipe the others. Write via
  // `useEffect` to satisfy `react-hooks/refs` (no ref writes during render).
  const productsConfigRef = useRef<ProductConfigEntry[] | undefined>(undefined);
  useEffect(() => {
    productsConfigRef.current = productConfigForFocus?.products_config;
  }, [productConfigForFocus?.products_config]);

  const mergeMarketplace = useCallback(
    (
      productKey: string,
      updated: ProductConfigEntry['marketplaces'][number],
    ): ProductConfigEntry['marketplaces'] => {
      const entry = productsConfigRef.current?.find(
        (e) => e.product_type === productKey,
      );
      const current = entry?.marketplaces ?? [];
      const idx = current.findIndex(
        (m) => m.marketplace === updated.marketplace,
      );
      if (idx === -1) return [...current, updated];
      const next = [...current];
      next[idx] = { ...next[idx], ...updated };
      return next;
    },
    [],
  );

  // Clear all pending timers on unmount so we don't PATCH against a stale
  // listing id after navigation.
  useEffect(
    () => () => {
      priceTimersRef.current.forEach((t) => clearTimeout(t));
      priceTimersRef.current.clear();
    },
    [],
  );

  // ---- Targeted PATCH helpers ------------------------------------------
  const patchEntry = useCallback(
    async (productKey: string, patch: EntryPatch) => {
      if (!designId) return;
      await enqueue({
        kind: 'updateProductConfig',
        designId,
        body: {
          marketplace_type: marketplaceType,
          op: 'upsert_product',
          product_type: productKey,
          patch,
        },
      });
    },
    [designId, marketplaceType, enqueue],
  );

  // ---- controlSetters (immediate PATCH) --------------------------------
  const controlSetters = useMemo(
    () => ({
      toggleProductEnabled: (productKey: string, enabled: boolean) =>
        patchEntry(productKey, { enabled }),
      setFitTypes: (productKey: string, fitTypes: string[]) =>
        patchEntry(productKey, { fit_types: fitTypes }),
      setPrintSide: (productKey: string, printSide: PrintSide) =>
        patchEntry(productKey, { print_side: printSide }),
      setColors: (productKey: string, colors: string[]) =>
        patchEntry(productKey, { colors }),
      /** Race-safe single-color toggle. Derives the next color list from
       *  `productsConfigRef.current` at call time so rapid clicks never
       *  read a stale closure — fixes the round-2 P3 "rapid color-click
       *  race" where successive clicks dropped earlier selections. */
      toggleColor: (productKey: string, colorKey: string) => {
        const entry = productsConfigRef.current?.find(
          (e) => e.product_type === productKey,
        );
        const current = entry?.colors ?? [];
        const next = current.includes(colorKey)
          ? current.filter((k) => k !== colorKey)
          : [...current, colorKey];
        return patchEntry(productKey, { colors: next });
      },
      /** Full-replace of the marketplaces array — caller constructs the
       *  next list. Prefer {@link setMarketplaceEnabled} for single-row
       *  toggles so the merge logic stays in one place. */
      setMarketplaces: (
        productKey: string,
        marketplaces: ProductConfigEntry['marketplaces'],
      ) => patchEntry(productKey, { marketplaces }),
      /** Targeted enable/disable for a single marketplace; other
       *  marketplaces keep their price + enabled state. Price defaults to
       *  the existing price, falling back to 0 for a brand-new row. */
      setMarketplaceEnabled: (
        productKey: string,
        marketplace: string,
        enabled: boolean,
      ) => {
        const current = productsConfigRef.current
          ?.find((e) => e.product_type === productKey)
          ?.marketplaces?.find((m) => m.marketplace === marketplace);
        const merged = mergeMarketplace(productKey, {
          marketplace,
          price: current?.price ?? 0,
          enabled,
        });
        return patchEntry(productKey, { marketplaces: merged });
      },
    }),
    [patchEntry, mergeMarketplace],
  );

  // ---- priceSetters (400ms debounce per key) ---------------------------
  // Debounced so rapid keystrokes collapse into a single PATCH. The PATCH
  // payload is the FULL merged marketplaces array so shallow-merge at
  // entry level on the backend doesn't wipe other marketplaces.
  const priceSetters = useMemo(
    () => ({
      setPrice: (productKey: string, marketplace: string, price: number) => {
        const key = `${productKey}::${marketplace}`;
        pendingPricePatchRef.current.set(key, { productKey, marketplace, price });
        const existing = priceTimersRef.current.get(key);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          priceTimersRef.current.delete(key);
          const pending = pendingPricePatchRef.current.get(key);
          if (!pending) return;
          pendingPricePatchRef.current.delete(key);
          const currentRow = productsConfigRef.current
            ?.find((e) => e.product_type === pending.productKey)
            ?.marketplaces?.find((m) => m.marketplace === pending.marketplace);
          const merged = mergeMarketplace(pending.productKey, {
            marketplace: pending.marketplace,
            price: pending.price,
            enabled: currentRow?.enabled ?? true,
          });
          void patchEntry(pending.productKey, { marketplaces: merged });
        }, PRICE_DEBOUNCE_MS);
        priceTimersRef.current.set(key, timer);
      },
    }),
    [patchEntry, mergeMarketplace],
  );

  // ---- textSetters (on-blur-if-dirty PATCH) ----------------------------
  const flushTextField = useCallback(
    async (field: TextField, value: string) => {
      if (!listingId) return;
      const current = listing?.[field] ?? '';
      if (current === value) return; // blur-if-dirty: no-op when unchanged
      dirtyTextRef.current.delete(field);
      await enqueue({
        kind: 'updateListing',
        id: listingId,
        body: { [field]: value } as Partial<Listing>,
      });
    },
    [listingId, listing, enqueue],
  );

  // ---- Translation (per-language) setters ------------------------------
  // On-blur-if-dirty diff against `listing.translations[lang][field]` so
  // EN-only edits stay on the top-level and every other locale writes to
  // the JSONField. Round-5 wire-up — unblocks DE/FR/IT/ES/JA tabs.
  const dirtyTranslationRef = useRef<
    Map<string /* `${lang}::${field}` */, string>
  >(new Map());

  const flushTranslatedField = useCallback(
    async (
      lang: string,
      field: TranslatableField,
      value: string,
    ) => {
      if (!listingId) return;
      const key = `${lang}::${field}`;
      const current =
        (listing?.translations?.[lang]?.[field] as string | undefined) ?? '';
      if (current === value) {
        dirtyTranslationRef.current.delete(key);
        return;
      }
      dirtyTranslationRef.current.delete(key);
      // Shallow-merge existing translations object so siblings survive.
      const existing = listing?.translations ?? {};
      const nextLang = { ...(existing[lang] ?? {}), [field]: value };
      const nextTranslations = { ...existing, [lang]: nextLang };
      await enqueue({
        kind: 'updateListing',
        id: listingId,
        body: { translations: nextTranslations } as Partial<Listing>,
      });
    },
    [listingId, listing, enqueue],
  );

  const textSetters = useMemo(
    () => ({
      onChange: (field: TextField, value: string) => {
        dirtyTextRef.current.set(field, value);
      },
      onBlur: (field: TextField, value: string) => flushTextField(field, value),
      /** Per-language on-change buffer (no PATCH yet). */
      onChangeTranslated: (
        lang: string,
        field: TranslatableField,
        value: string,
      ) => {
        dirtyTranslationRef.current.set(`${lang}::${field}`, value);
      },
      /** Per-language on-blur flush — PATCHes `translations` JSONField. */
      onBlurTranslated: (
        lang: string,
        field: TranslatableField,
        value: string,
      ) => flushTranslatedField(lang, field, value),
    }),
    [flushTextField, flushTranslatedField],
  );

  // ---- Global/Displate setters (Phase U / Phase V, immediate PATCH) -----
  // Per AC-86 / AC-108, every add/remove/toggle on the Global + Displate
  // tabs fires an atomic immediate PATCH -- no debounce. We funnel through
  // the offline queue so a dropped connection still replays the write.
  const patchListing = useCallback(
    async (body: Partial<Listing>) => {
      if (!listingId) return;
      await enqueue({
        kind: 'updateListing',
        id: listingId,
        body,
      });
    },
    [listingId, enqueue],
  );

  const keywordsSetters = useMemo(
    () => ({
      /** Replace the full keyword array for a language -- used for bulk
       *  ops (Import CSV, Copy-EN-to-all, Clear all). The merge semantics
       *  are "clients sends the whole dict back" so siblings survive. */
      setAll: (lang: ListingLanguage, keywords: string[]) => {
        const existing = listing?.keywords ?? {};
        const next: ListingKeywords = { ...existing, [lang]: keywords };
        return patchListing({ keywords: next });
      },
      /** Append a single trimmed keyword to `lang`'s list. Idempotent --
       *  skips case-insensitive duplicates (AC-84). Caller is responsible
       *  for 50-char-total enforcement (AC-85); the hook is pure storage. */
      commitChip: (lang: ListingLanguage, keyword: string) => {
        const existing = listing?.keywords ?? {};
        const current = existing[lang] ?? [];
        const clean = keyword.trim();
        if (!clean) return Promise.resolve();
        const lower = clean.toLowerCase();
        if (current.some((k) => k.toLowerCase() === lower)) {
          return Promise.resolve();
        }
        const next: ListingKeywords = {
          ...existing,
          [lang]: [...current, clean],
        };
        return patchListing({ keywords: next });
      },
      /** Remove the chip at `idx` for `lang`. No-op when out of bounds. */
      removeChip: (lang: ListingLanguage, idx: number) => {
        const existing = listing?.keywords ?? {};
        const current = existing[lang] ?? [];
        if (idx < 0 || idx >= current.length) return Promise.resolve();
        const nextList = current.filter((_, i) => i !== idx);
        const next: ListingKeywords = { ...existing, [lang]: nextList };
        return patchListing({ keywords: next });
      },
    }),
    [listing?.keywords, patchListing],
  );

  const typeFlagsSetter = useCallback(
    (flags: ListingTypeFlag[]) => patchListing({ type_flags: flags }),
    [patchListing],
  );

  const colorModeSetter = useCallback(
    (mode: ListingColorMode) => patchListing({ color_mode: mode }),
    [patchListing],
  );

  const bgHexSetter = useCallback(
    (hex: string) => patchListing({ background_color_hex: hex }),
    [patchListing],
  );

  const categorySetter = useCallback(
    (category: string) => patchListing({ category }),
    [patchListing],
  );

  /** Batched brand + category -- used by AdvancedOptionsDialog Save (AC-132). */
  const advancedOptionsSetter = useCallback(
    (brand: string, category: string) =>
      patchListing({ brand_name: brand, category }),
    [patchListing],
  );

  // ---- manualSave / discard --------------------------------------------
  const manualSave = useCallback(async () => {
    // Flush any timers that haven't fired.
    priceTimersRef.current.forEach((t) => clearTimeout(t));
    priceTimersRef.current.clear();
    const prices = Array.from(pendingPricePatchRef.current.values());
    pendingPricePatchRef.current.clear();
    await Promise.all(
      prices.map((p) => {
        const currentRow = productsConfigRef.current
          ?.find((e) => e.product_type === p.productKey)
          ?.marketplaces?.find((m) => m.marketplace === p.marketplace);
        const merged = mergeMarketplace(p.productKey, {
          marketplace: p.marketplace,
          price: p.price,
          enabled: currentRow?.enabled ?? true,
        });
        return patchEntry(p.productKey, { marketplaces: merged });
      }),
    );
    // Flush any text field that was touched but not blurred.
    const texts = Array.from(dirtyTextRef.current.entries());
    dirtyTextRef.current.clear();
    await Promise.all(texts.map(([field, value]) => flushTextField(field, value)));
    // Flush any translation field that was touched but not blurred.
    const translations = Array.from(dirtyTranslationRef.current.entries());
    dirtyTranslationRef.current.clear();
    await Promise.all(
      translations.map(([key, value]) => {
        const [lang, field] = key.split('::') as [string, TranslatableField];
        return flushTranslatedField(lang, field, value);
      }),
    );
  }, [patchEntry, flushTextField, flushTranslatedField, mergeMarketplace]);

  const discard = useCallback(() => {
    // Client-side reset only — no PATCH. RTK cache is already source of
    // truth; clearing the dirty refs + cancelling pending timers is enough.
    priceTimersRef.current.forEach((t) => clearTimeout(t));
    priceTimersRef.current.clear();
    pendingPricePatchRef.current.clear();
    dirtyTextRef.current.clear();
    dirtyTranslationRef.current.clear();
  }, []);

  // ---- AI Improve -------------------------------------------------------
  const aiImprove = useCallback(async () => {
    if (!listingId) return null;
    const result = await aiImproveListing(listingId).unwrap();
    return result;
  }, [listingId, aiImproveListing]);

  // ---- royaltyFor -------------------------------------------------------
  const royaltyFor = useCallback(
    (productKey: string, marketplace: string, price: number | null | undefined) =>
      computeRoyalty(catalog, productKey, marketplace, price),
    [catalog],
  );

  // ---- Composite state flags -------------------------------------------
  const isSaving = isSavingConfig || isSavingListing || isImproving;
  const saveError =
    ((configError ?? listingError ?? improveError) as Error | null) ?? null;

  // `isDirty` is true whenever a blur-pending text or an in-flight debounced
  // price patch exists. We don't re-render on every keystroke — callers that
  // need per-tick accuracy can read the ref directly.
  const [isDirty, setIsDirty] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      const dirty =
        dirtyTextRef.current.size > 0 ||
        pendingPricePatchRef.current.size > 0 ||
        dirtyTranslationRef.current.size > 0;
      setIsDirty((prev) => (prev === dirty ? prev : dirty));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return {
    // Focused product (per-product section scope)
    focusedProduct,
    setFocusedProduct,
    // Setter factories
    controlSetters,
    priceSetters,
    textSetters,
    // Phase U/V (2026-04-24) -- Global + Displate setters (immediate PATCH)
    keywordsSetters,
    typeFlagsSetter,
    colorModeSetter,
    bgHexSetter,
    categorySetter,
    advancedOptionsSetter,
    // Manual save + discard
    manualSave,
    discard,
    // AI Improve
    aiImprove,
    isImproving,
    // Catalog-derived pure function
    royaltyFor,
    // Composite flags
    isDirty,
    isSaving,
    saveError,
    // Offline queue (Phase O4)
    isOnline,
    queueLength,
    // Fields the hook handles (exposed so P components can loop over them)
    textFields: TEXT_FIELDS,
  };
};

export type UseEditFormStateReturn = ReturnType<typeof useEditFormState>;
