import { useCallback, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  usePreviewExportMutation,
  useRunExportMutation,
} from '@/store/publishSlice';
import type {
  FlyingUploadExportBody,
  FlyingUploadPreviewResponse,
} from '../types';
import { extractErrorCode, mapExportError } from '../utils/mapExportError';

// ---------------------------------------------------------------------------
// useExport — Phase W1 (AC-112, AC-113)
// ---------------------------------------------------------------------------
// Thin wrapper around `previewExport` + `runExport` RTK mutations. Adds:
// - 60s Promise.race timeout on `download` (AC-112)
// - notistack error snackbars via `mapExportError` (AC-113)
// - anchor-based blob download with URL.revokeObjectURL cleanup
// ---------------------------------------------------------------------------

export const DOWNLOAD_TIMEOUT_MS = 60_000;

/** Trigger a browser download for a blob using a disposable `<a>` anchor. */
const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Allow the browser to actually initiate the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

export interface UseExportReturn {
  preflight: (
    body: FlyingUploadExportBody,
  ) => Promise<FlyingUploadPreviewResponse | null>;
  download: (body: FlyingUploadExportBody) => Promise<boolean>;
  isPreflighting: boolean;
  isDownloading: boolean;
}

/**
 * Internal — wraps a promise in a timeout. Rejects with a sentinel error code
 * so the caller surfaces the correct snackbar.
 */
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () => reject({ data: { error: { code: 'export_timed_out' } } }),
      ms,
    );
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
};

export const useExport = (): UseExportReturn => {
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const [previewMutation, previewState] = usePreviewExportMutation();
  const [runMutation, runState] = useRunExportMutation();
  const [isTimingOut, setIsTimingOut] = useState(false);

  const surfaceError = useCallback(
    (err: unknown) => {
      const code = extractErrorCode(err);
      const key = mapExportError(code);
      enqueueSnackbar(t(key, { defaultValue: t('publish.export.errors.generic') }), {
        variant: 'error',
      });
    },
    [enqueueSnackbar, t],
  );

  const preflight = useCallback(
    async (
      body: FlyingUploadExportBody,
    ): Promise<FlyingUploadPreviewResponse | null> => {
      try {
        return await previewMutation(body).unwrap();
      } catch (err) {
        surfaceError(err);
        return null;
      }
    },
    [previewMutation, surfaceError],
  );

  const download = useCallback(
    async (body: FlyingUploadExportBody): Promise<boolean> => {
      setIsTimingOut(true);
      try {
        const result = await withTimeout(
          runMutation(body).unwrap(),
          DOWNLOAD_TIMEOUT_MS,
        );
        if (!result?.blob) {
          surfaceError(null);
          return false;
        }
        triggerBlobDownload(result.blob, result.filename ?? 'export');
        return true;
      } catch (err) {
        surfaceError(err);
        return false;
      } finally {
        setIsTimingOut(false);
      }
    },
    [runMutation, surfaceError],
  );

  return {
    preflight,
    download,
    isPreflighting: previewState.isLoading,
    isDownloading: runState.isLoading || isTimingOut,
  };
};
