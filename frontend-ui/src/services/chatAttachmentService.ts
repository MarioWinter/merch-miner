/**
 * PROJ-20 Phase 7 — Chat-attachment HTTP service.
 *
 * Multipart uploads can't go through RTK Query as cleanly as JSON, so this
 * thin axios wrapper sits alongside the slice.
 */

import { apiClient } from './authService';

import type { ChatAttachment } from '@/types/search';

interface UploadResponse {
  attachments: ChatAttachment[];
}

export const uploadChatAttachments = async (
  files: File[],
): Promise<ChatAttachment[]> => {
  const form = new FormData();
  for (const f of files) {
    form.append('files', f);
  }
  const { data } = await apiClient.post<UploadResponse>(
    '/api/chat/attachments/',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.attachments;
};

export const deleteChatAttachment = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/chat/attachments/${encodeURIComponent(id)}/`);
};
