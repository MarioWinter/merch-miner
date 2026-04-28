/**
 * PROJ-20 Phase 7.7 — AttachmentBar tests.
 *
 * Verifies preview cards render per-upload, status states surface (uploading
 * spinner, failed icon), and the ✕ button calls the remove hook.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '@/utils/test-utils';
import attachmentsReducer, {
  addUpload,
  updateUploadStatus,
} from '@/store/attachmentsSlice';
import AttachmentBar from '../partials/AttachmentBar';

const mockRemove = vi.fn();
vi.mock('../hooks/useAttachmentUpload', () => ({
  useAttachmentUpload: () => ({
    upload: vi.fn(),
    remove: mockRemove,
  }),
}));

const reducers = { attachments: attachmentsReducer };

describe('AttachmentBar', () => {
  it('renders nothing when no uploads exist', () => {
    const { container } = renderWithProviders(<AttachmentBar />, { reducers });
    expect(
      container.querySelector('[data-testid="chat-input-attachment-bar"]'),
    ).toBeNull();
  });

  it('renders one card per upload with filename + size', async () => {
    const { store } = renderWithProviders(<AttachmentBar />, { reducers });
    await act(async () => {
      store.dispatch(
        addUpload({
          localId: 'l1',
          serverId: null,
          filename: 'first.png',
          mime_type: 'image/png',
          size: 12345,
          thumbnail_url: 'data:image/png;base64,AAA',
          status: 'uploading',
        }),
      );
      store.dispatch(
        addUpload({
          localId: 'l2',
          serverId: 'srv-2',
          filename: 'second.png',
          mime_type: 'image/png',
          size: 2_500_000,
          thumbnail_url: 'data:image/png;base64,BBB',
          status: 'completed',
        }),
      );
    });
    expect(screen.getByTestId('chat-input-attachment-bar')).toBeInTheDocument();
    expect(screen.getByText('first.png')).toBeInTheDocument();
    expect(screen.getByText('12 KB')).toBeInTheDocument();
    expect(screen.getByText('2.4 MB')).toBeInTheDocument();
  });

  it('uploading card shows a CircularProgress spinner', async () => {
    const { store, container } = renderWithProviders(<AttachmentBar />, { reducers });
    await act(async () => {
      store.dispatch(
        addUpload({
          localId: 'l1',
          serverId: null,
          filename: 'pending.png',
          mime_type: 'image/png',
          size: 1024,
          thumbnail_url: null,
          status: 'uploading',
        }),
      );
    });
    expect(container.querySelector('.MuiCircularProgress-root')).not.toBeNull();
  });

  it('failed card surfaces ErrorOutlineIcon', async () => {
    const { store } = renderWithProviders(<AttachmentBar />, { reducers });
    await act(async () => {
      store.dispatch(
        addUpload({
          localId: 'l1',
          serverId: null,
          filename: 'broken.png',
          mime_type: 'image/png',
          size: 1024,
          thumbnail_url: null,
          status: 'uploading',
        }),
      );
      store.dispatch(
        updateUploadStatus({
          localId: 'l1',
          status: 'failed',
          error: 'boom',
        }),
      );
    });
    expect(
      document.querySelector('[data-testid="ErrorOutlineIcon"]'),
    ).not.toBeNull();
  });

  it('clicking ✕ on a card calls remove(localId, serverId)', async () => {
    const { store } = renderWithProviders(<AttachmentBar />, { reducers });
    await act(async () => {
      store.dispatch(
        addUpload({
          localId: 'l1',
          serverId: 'srv-1',
          filename: 'rm.png',
          mime_type: 'image/png',
          size: 1024,
          thumbnail_url: null,
          status: 'completed',
        }),
      );
    });
    const removeBtn = screen.getByLabelText(/remove image/i);
    fireEvent.click(removeBtn);
    expect(mockRemove).toHaveBeenCalledWith('l1', 'srv-1');
  });
});
