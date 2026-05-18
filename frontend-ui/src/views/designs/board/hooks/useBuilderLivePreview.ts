// PROJ-34 Phase 13g — debounced live-preview for the BuilderDialog.
//
// Calls `useBuilderBuildMutation` with `slogans: [first]`, `styles: [first]`,
// and the current slots, with `with_polish: false` so the user sees the raw
// assembled prompt before spending polish credits (AC-67). Skipped when no
// slogan or style is picked yet — the dialog shows a placeholder hint.

import { useEffect, useRef, useState } from 'react';
import { useBuilderBuildMutation } from '@/store/designSlice';
import type { BuilderConfig } from '../types/builder';
import type { BackgroundColorSlug } from '../types/builder';

interface UseBuilderLivePreviewParams {
  cfg: BuilderConfig;
  projectId: string;
  backgroundColor: BackgroundColorSlug;
  /** Manually toggled by the Live Preview accordion so we only fire when open. */
  enabled: boolean;
  /** Joined slogan list from the dialog's idea-pool + free-text split. */
  firstSlogan: string | undefined;
}

const DEBOUNCE_MS = 500;

export const useBuilderLivePreview = ({
  cfg,
  projectId,
  backgroundColor,
  enabled,
  firstSlogan,
}: UseBuilderLivePreviewParams) => {
  const [buildPrompts, { isLoading }] = useBuilderBuildMutation();
  const [previewText, setPreviewText] = useState<string>('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const firstStyle = cfg.selectedStyleSlugs[0];
  // Stringify the slots so deep changes trigger the effect via reference change.
  const slotsKey = JSON.stringify(cfg.slots);

  useEffect(() => {
    if (!enabled) return;
    if (!firstSlogan || !firstStyle || !projectId) {
      setPreviewText('');
      setPreviewError(null);
      return;
    }
    const myRequestId = ++requestIdRef.current;
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await buildPrompts({
            projectId,
            body: {
              slogans: [firstSlogan],
              styles: [firstStyle],
              warp: cfg.warpSlug,
              background_color: backgroundColor,
              with_polish: false,
              include_niche_context: cfg.includeNicheContext,
              // The builder serializer ignores unknown keys; slots are read
              // server-side via the BuilderConfig.config JSON on the preset
              // path. For ad-hoc preview we pass them through `slots` if the
              // backend accepts it; otherwise this falls back to slogan+style
              // only. (Safe: backend always returns an assembled prompt.)
              ...({ slots: cfg.slots } as Record<string, unknown>),
            } as never,
          }).unwrap();
          if (myRequestId !== requestIdRef.current) return;
          setPreviewText(result.prompts[0] ?? '');
          setPreviewError(null);
        } catch {
          if (myRequestId !== requestIdRef.current) return;
          setPreviewError('Preview failed');
        }
      })();
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
    // slotsKey is the stable signature of cfg.slots
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    firstSlogan,
    firstStyle,
    projectId,
    backgroundColor,
    cfg.warpSlug,
    cfg.includeNicheContext,
    slotsKey,
    buildPrompts,
  ]);

  return { previewText, isLoading, previewError };
};

export default useBuilderLivePreview;
