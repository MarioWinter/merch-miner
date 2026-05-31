import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnackbar, closeSnackbar } from 'notistack';
import { Button } from '@mui/material';
import { createElement } from 'react';
import { useAppSelector } from '@/store/hooks';

/**
 * Phase B (FIX-canvas-editor-bugs-and-image-gen) — global completion snackbar
 * for single-design upscales.
 *
 * Mounted ONCE inside `App.tsx`, after auth/providers and before `Routes`, so
 * that completions surface regardless of which view the user navigated to.
 * Replaces the snackbar block formerly hosted by `useUpscaleCompletionMonitor`
 * — the workspace-scoped variant only fired while `DesignWorkspaceView` was
 * mounted, which is exactly the case the user complaint targets.
 *
 * Dedup: `lastCompletion.ts` is treated as the unique key per completion
 * event. A `useRef` remembers the last handled `ts` and skips re-fires across
 * re-renders (e.g. unrelated Redux state changes).
 *
 * Action: when `projectId` is present, the snackbar renders a "Open in
 * Canvas" button that navigates to `/designs/<projectId>` and dismisses the
 * snackbar. Missing `projectId` falls back to a plain (action-less) snackbar.
 */
export const useGlobalUpscaleNotifications = (): void => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const lastCompletion = useAppSelector((s) => s.upscale.lastCompletion);
  const handledTsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!lastCompletion) return;
    if (handledTsRef.current === lastCompletion.ts) return;
    handledTsRef.current = lastCompletion.ts;

    if (lastCompletion.kind === 'success') {
      const projectId = lastCompletion.projectId;
      enqueueSnackbar(
        t('upscale.snackbar.singleDone', { defaultValue: 'Upscale done' }),
        {
          variant: 'success',
          action: projectId
            ? (snackbarId) =>
                createElement(
                  Button,
                  {
                    color: 'inherit',
                    size: 'small',
                    onClick: () => {
                      navigate(`/designs/${projectId}`);
                      closeSnackbar(snackbarId);
                    },
                  },
                  t('upscale.snackbar.singleDoneAction', {
                    defaultValue: 'Open in Canvas',
                  }),
                )
            : undefined,
        },
      );
      return;
    }

    if (lastCompletion.reason === 'timeout') {
      enqueueSnackbar(
        t('upscale.snackbar.singleTimeout', {
          defaultValue:
            'Upscale is taking longer than expected — check back later.',
        }),
        { variant: 'warning' },
      );
      return;
    }

    enqueueSnackbar(
      t('upscale.snackbar.singleFailed', { defaultValue: 'Upscale failed' }),
      { variant: 'error' },
    );
  }, [enqueueSnackbar, lastCompletion, navigate, t]);
};

export default useGlobalUpscaleNotifications;
