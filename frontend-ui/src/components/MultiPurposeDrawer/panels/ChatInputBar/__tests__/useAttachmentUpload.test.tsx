/**
 * PROJ-20 Phase 7.7 — useAttachmentUpload hook tests.
 *
 * Covers the validation pipeline + upload/delete dispatch flow without
 * touching the real network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import attachmentsReducer from '@/store/attachmentsSlice';
import { useAttachmentUpload } from '../hooks/useAttachmentUpload';

const mockUpload = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/services/chatAttachmentService', () => ({
  uploadChatAttachments: (...args: unknown[]) => mockUpload(...args),
  deleteChatAttachment: (...args: unknown[]) => mockDelete(...args),
}));

const mockSnackbar = vi.fn();
vi.mock('notistack', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useSnackbar: () => ({
      enqueueSnackbar: mockSnackbar,
      closeSnackbar: vi.fn(),
    }),
  };
});

import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { CssVarsProvider } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../../../../../../public/locales/en/translation.json';
import theme from '@/style/theme';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: enTranslation } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

const buildStore = () =>
  configureStore({ reducer: { attachments: attachmentsReducer } });

const renderUploadHook = () => {
  const store = buildStore();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <CssVarsProvider theme={theme} defaultMode="dark">
        <SnackbarProvider maxSnack={4}>{children}</SnackbarProvider>
      </CssVarsProvider>
    </Provider>
  );
  const hook = renderHook(() => useAttachmentUpload(), { wrapper });
  return { store, ...hook };
};

const makeFile = (name: string, type: string, size: number): File => {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUpload.mockReset();
  mockDelete.mockReset();
  mockSnackbar.mockReset();
});

describe('useAttachmentUpload', () => {
  it('rejects oversize files (>10MB) with a snackbar — no upload fired', async () => {
    const { result, store } = renderUploadHook();
    const oversize = makeFile('huge.png', 'image/png', 11 * 1024 * 1024);
    await act(async () => {
      await result.current.upload([oversize]);
    });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockSnackbar).toHaveBeenCalled();
    expect(store.getState().attachments.uploads).toHaveLength(0);
  });

  it('rejects non-image mime types with a snackbar', async () => {
    const { result } = renderUploadHook();
    const txt = makeFile('notes.txt', 'text/plain', 100);
    await act(async () => {
      await result.current.upload([txt]);
    });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockSnackbar).toHaveBeenCalled();
  });

  it('rejects more than 5 files with a snackbar', async () => {
    const { result, store } = renderUploadHook();
    const six = Array.from({ length: 6 }).map((_, i) =>
      makeFile(`f${i}.png`, 'image/png', 100),
    );
    await act(async () => {
      await result.current.upload(six);
    });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockSnackbar).toHaveBeenCalled();
    expect(store.getState().attachments.uploads).toHaveLength(0);
  });

  it('happy path — adds optimistic uploads, swaps in serverId on success', async () => {
    mockUpload.mockResolvedValue([
      {
        id: 'srv-1',
        filename: 'a.png',
        mime_type: 'image/webp',
        size: 100,
        thumbnail_url: '/media/a.webp',
        attachment_type: 'image',
        status: 'completed',
        created_at: '2026-04-28T00:00:00Z',
        purged_at: null,
      },
    ]);
    const { result, store } = renderUploadHook();
    const f = makeFile('a.png', 'image/png', 100);
    await act(async () => {
      await result.current.upload([f]);
    });
    const uploads = store.getState().attachments.uploads;
    expect(uploads).toHaveLength(1);
    expect(uploads[0].status).toBe('completed');
    expect(uploads[0].serverId).toBe('srv-1');
    expect(uploads[0].thumbnail_url).toBe('/media/a.webp');
  });

  it('marks uploads as failed when the service rejects', async () => {
    mockUpload.mockRejectedValue(new Error('500'));
    const { result, store } = renderUploadHook();
    const f = makeFile('a.png', 'image/png', 100);
    await act(async () => {
      await result.current.upload([f]);
    });
    const uploads = store.getState().attachments.uploads;
    expect(uploads[0].status).toBe('failed');
    expect(mockSnackbar).toHaveBeenCalled();
  });

  it('remove() drops the card and DELETEs server-side when there is a serverId', async () => {
    mockUpload.mockResolvedValue([
      {
        id: 'srv-1',
        filename: 'a.png',
        mime_type: 'image/webp',
        size: 100,
        thumbnail_url: '/media/a.webp',
        attachment_type: 'image',
        status: 'completed',
        created_at: '2026-04-28T00:00:00Z',
        purged_at: null,
      },
    ]);
    mockDelete.mockResolvedValue(undefined);
    const { result, store } = renderUploadHook();
    const f = makeFile('a.png', 'image/png', 100);
    await act(async () => {
      await result.current.upload([f]);
    });
    const localId = store.getState().attachments.uploads[0].localId;
    await act(async () => {
      await result.current.remove(localId, 'srv-1');
    });
    expect(store.getState().attachments.uploads).toHaveLength(0);
    expect(mockDelete).toHaveBeenCalledWith('srv-1');
  });
});
