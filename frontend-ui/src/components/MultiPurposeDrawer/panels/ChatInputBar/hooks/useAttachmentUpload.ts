/**
 * PROJ-20 Phase 7.5 — file → server upload coordinator.
 *
 * Handles the full lifecycle of an upload: client-side validation, optimistic
 * card insertion, axios POST, status update, snackbar errors. Used by the
 * file-input + drag-drop + paste handlers in `ChatInputBar`.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';

import { useAppDispatch } from '@/store/hooks';
import {
  addUpload,
  removeUpload,
  updateUploadStatus,
} from '@/store/attachmentsSlice';
import {
  deleteChatAttachment,
  uploadChatAttachments,
} from '@/services/chatAttachmentService';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const genLocalId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const readDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });

export const useAttachmentUpload = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();

  /** Upload a batch of File objects (drag-drop, paste, or file-picker). */
  const upload = useCallback(
    async (files: File[]): Promise<void> => {
      if (files.length === 0) return;

      // Per-batch caps. The server enforces the same limits but we surface
      // friendly errors before sending so users don't waste bandwidth.
      const valid: File[] = [];
      let totalBytes = 0;
      for (const f of files) {
        if (!ALLOWED_TYPES.has(f.type)) {
          enqueueSnackbar(
            t('search.attachments.error.invalidType', { name: f.name }),
            { variant: 'error' },
          );
          continue;
        }
        if (f.size > MAX_FILE_BYTES) {
          enqueueSnackbar(
            t('search.attachments.error.tooLarge', { name: f.name }),
            { variant: 'error' },
          );
          continue;
        }
        totalBytes += f.size;
        valid.push(f);
      }
      if (valid.length === 0) return;
      if (valid.length > MAX_FILES) {
        enqueueSnackbar(
          t('search.attachments.error.tooMany', { max: MAX_FILES }),
          { variant: 'error' },
        );
        return;
      }
      if (totalBytes > MAX_TOTAL_BYTES) {
        enqueueSnackbar(
          t('search.attachments.error.totalTooLarge'),
          { variant: 'error' },
        );
        return;
      }

      // Insert optimistic cards with data-url previews so the user sees
      // their image immediately even before the server responds.
      const localIds: string[] = [];
      for (const f of valid) {
        const localId = genLocalId();
        localIds.push(localId);
        let preview: string | null = null;
        try {
          preview = await readDataUrl(f);
        } catch {
          /* fall back to no preview */
        }
        dispatch(
          addUpload({
            localId,
            serverId: null,
            filename: f.name,
            mime_type: f.type,
            size: f.size,
            thumbnail_url: preview,
            status: 'uploading',
          }),
        );
      }

      try {
        const results = await uploadChatAttachments(valid);
        // Server returns the list in the same order as the form fields;
        // map by index back onto our local cards.
        results.forEach((res, i) => {
          const localId = localIds[i];
          if (!localId) return;
          dispatch(
            updateUploadStatus({
              localId,
              status: 'completed',
              serverId: res.id,
              thumbnail_url: res.thumbnail_url,
            }),
          );
        });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Upload failed';
        for (const localId of localIds) {
          dispatch(
            updateUploadStatus({
              localId,
              status: 'failed',
              error: msg,
            }),
          );
        }
        enqueueSnackbar(t('search.attachments.error.uploadFailed'), {
          variant: 'error',
        });
      }
    },
    [dispatch, enqueueSnackbar, t],
  );

  /** Remove an attachment card. If the upload completed we also DELETE on
   *  the server so storage doesn't accumulate orphans. */
  const remove = useCallback(
    async (localId: string, serverId: string | null) => {
      dispatch(removeUpload(localId));
      if (serverId) {
        try {
          await deleteChatAttachment(serverId);
        } catch {
          // Non-fatal — purge job will eventually clean it up.
        }
      }
    },
    [dispatch],
  );

  return { upload, remove };
};
