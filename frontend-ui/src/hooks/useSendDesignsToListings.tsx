import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar, type SnackbarKey } from 'notistack';
import { useTranslation } from 'react-i18next';
import { Button, Stack } from '@mui/material';
import {
  sendDesignsInChunks,
  SEND_TO_LISTINGS_BULK_THRESHOLD,
  useSendDesignsToListingsMutation,
} from '@/store/publishSlice';
import type {
  DesignAssetFromDesignBody,
  DesignAssetFromDesignResponse,
} from '@/views/publish/types';

interface UseSendDesignsToListingsOptions {
  /** Called after a successful (or partial) send so callers can clear local selection / exit select mode. */
  onSuccess?: (response: DesignAssetFromDesignResponse) => void;
}

interface SendOptions {
  /** Skip the > BULK_THRESHOLD confirmation dialog (caller-confirmed). */
  skipConfirm?: boolean;
}

interface PendingConfirm {
  designIds: string[];
}

/**
 * Centralised wrapper around `useSendDesignsToListingsMutation` that handles:
 * - Chunking at SEND_TO_LISTINGS_BULK_THRESHOLD
 * - Conditional snackbar persistence (created>0 persist, info auto-close, retry persist)
 * - Confirmation flow when count > threshold (returns `pendingConfirm` for the caller to render a dialog)
 */
const useSendDesignsToListings = ({ onSuccess }: UseSendDesignsToListingsOptions = {}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const [trigger, status] = useSendDesignsToListingsMutation();
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const performSendRef = useRef<(designIds: string[]) => Promise<void>>(async () => {});

  const runner = useCallback(
    (body: DesignAssetFromDesignBody) => trigger(body).unwrap(),
    [trigger],
  );

  const renderRetryAction = useCallback(
    (originalIds: string[]) => (snackKey: SnackbarKey) => (
      <Stack direction="row" spacing={0.5}>
        <Button
          size="small"
          color="inherit"
          onClick={() => {
            closeSnackbar(snackKey);
            void performSendRef.current(originalIds);
          }}
        >
          {t('designs.sendToListings.retry', 'Retry')}
        </Button>
        <Button size="small" color="inherit" onClick={() => closeSnackbar(snackKey)}>
          {t('common.close', 'Close')}
        </Button>
      </Stack>
    ),
    [closeSnackbar, t],
  );

  const renderOpenAction = useCallback(
    () => (snackKey: SnackbarKey) => (
      <Stack direction="row" spacing={0.5}>
        <Button
          size="small"
          color="inherit"
          onClick={() => {
            closeSnackbar(snackKey);
            navigate('/listings');
          }}
        >
          {t('designs.sendToListings.openInPublish', 'Open in Publish')}
        </Button>
        <Button size="small" color="inherit" onClick={() => closeSnackbar(snackKey)}>
          {t('common.close', 'Close')}
        </Button>
      </Stack>
    ),
    [closeSnackbar, navigate, t],
  );

  const showResultSnackbar = useCallback(
    (response: DesignAssetFromDesignResponse, originalIds: string[]) => {
      const created = response.created.length;
      const skipped = response.skipped_duplicates.length;
      const failed = response.failed?.length ?? 0;

      if (failed > 0) {
        enqueueSnackbar(t('designs.sendToListings.partialFailure', { failed }), {
          variant: 'warning',
          persist: true,
          action: renderRetryAction(originalIds),
        });
        return;
      }

      if (created > 0) {
        enqueueSnackbar(t('designs.sendToListings.successCount', { created, skipped }), {
          variant: 'success',
          persist: true,
          action: renderOpenAction(),
        });
        return;
      }

      if (skipped > 0) {
        enqueueSnackbar(t('designs.sendToListings.successCount', { created: 0, skipped }), {
          variant: 'info',
        });
        return;
      }

      enqueueSnackbar(t('designs.sendToListings.noEligible', 'No approved designs to send.'), {
        variant: 'warning',
      });
    },
    [enqueueSnackbar, renderRetryAction, renderOpenAction, t],
  );

  const performSend = useCallback(
    async (designIds: string[]) => {
      try {
        const response = await sendDesignsInChunks(designIds, runner);
        showResultSnackbar(response, designIds);
        onSuccess?.(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : t('common.unexpectedError', 'Unexpected error');
        enqueueSnackbar(message, { variant: 'error' });
      }
    },
    [runner, showResultSnackbar, onSuccess, enqueueSnackbar, t],
  );

  // Keep ref pointed at the latest performSend so snackbar action retries call current closure.
  useEffect(() => {
    performSendRef.current = performSend;
  }, [performSend]);

  const send = useCallback(
    async (designIds: string[], opts: SendOptions = {}) => {
      if (designIds.length === 0) {
        enqueueSnackbar(t('designs.sendToListings.noEligible', 'No approved designs to send.'), {
          variant: 'warning',
        });
        return;
      }
      if (designIds.length > SEND_TO_LISTINGS_BULK_THRESHOLD && !opts.skipConfirm) {
        setPendingConfirm({ designIds });
        return;
      }
      await performSend(designIds);
    },
    [enqueueSnackbar, performSend, t],
  );

  const confirmPending = useCallback(async () => {
    const pending = pendingConfirm;
    if (!pending) return;
    setPendingConfirm(null);
    await performSend(pending.designIds);
  }, [pendingConfirm, performSend]);

  const cancelPending = useCallback(() => setPendingConfirm(null), []);

  return {
    send,
    isSending: status.isLoading,
    pendingConfirm,
    confirmPending,
    cancelPending,
  };
};

export default useSendDesignsToListings;
