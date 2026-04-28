/**
 * PROJ-20 Phase 7 — chat image attachments slice.
 *
 * Tracks uploads in flight + completed/failed cards keyed by `localId` so the
 * UI can render a card before the server returns the real id. ChatInputBar
 * reads this state to show the AttachmentBar and to gate the Send button.
 *
 * Cleared on message send (`done` SSE event) so the next message starts fresh.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AttachmentUpload, ChatAttachmentStatus } from '@/types/search';

interface AttachmentsState {
  /** Order = upload sequence, latest at the end. */
  uploads: AttachmentUpload[];
}

const initialState: AttachmentsState = {
  uploads: [],
};

const attachmentsSlice = createSlice({
  name: 'attachments',
  initialState,
  reducers: {
    addUpload: (state, action: PayloadAction<AttachmentUpload>) => {
      state.uploads.push(action.payload);
    },
    updateUploadStatus: (
      state,
      action: PayloadAction<{
        localId: string;
        status: ChatAttachmentStatus;
        serverId?: string;
        thumbnail_url?: string | null;
        error?: string;
      }>,
    ) => {
      const u = state.uploads.find((x) => x.localId === action.payload.localId);
      if (!u) return;
      u.status = action.payload.status;
      if (action.payload.serverId !== undefined) {
        u.serverId = action.payload.serverId;
      }
      if (action.payload.thumbnail_url !== undefined) {
        u.thumbnail_url = action.payload.thumbnail_url;
      }
      if (action.payload.error !== undefined) {
        u.error = action.payload.error;
      }
    },
    removeUpload: (state, action: PayloadAction<string>) => {
      state.uploads = state.uploads.filter(
        (u) => u.localId !== action.payload,
      );
    },
    clearAttachments: (state) => {
      state.uploads = [];
    },
  },
});

export const {
  addUpload,
  updateUploadStatus,
  removeUpload,
  clearAttachments,
} = attachmentsSlice.actions;

export default attachmentsSlice.reducer;
