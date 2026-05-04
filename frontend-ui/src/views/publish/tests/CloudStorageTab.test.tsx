import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type { CloudFile, CloudFolder } from '@/components/CloudStorage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
//
// CloudStorageTab composes two provider hooks (Google Drive + OneDrive) plus
// one RTK Query mutation for imports. We stub all three to exercise the tab's
// branching (connection state, provider switch, import callback) without
// touching real OAuth or network code.

interface MockProviderState {
  isConnected: boolean;
  isConnecting: boolean;
  isConfigured: boolean;
  error: string | null;
  accountEmail: string | null;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  listFolders: ReturnType<typeof vi.fn>;
  listImages: ReturnType<typeof vi.fn>;
  downloadFile: ReturnType<typeof vi.fn>;
  uploadFile: ReturnType<typeof vi.fn>;
}

const makeProviderState = (
  overrides: Partial<MockProviderState> = {},
): MockProviderState => ({
  isConnected: true,
  isConnecting: false,
  isConfigured: true,
  error: null,
  accountEmail: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  listFolders: vi.fn().mockResolvedValue([] as CloudFolder[]),
  listImages: vi.fn().mockResolvedValue([] as CloudFile[]),
  downloadFile: vi.fn(),
  uploadFile: vi.fn(),
  ...overrides,
});

const gdriveState: MockProviderState = makeProviderState();
const onedriveState: MockProviderState = makeProviderState();

vi.mock('@/components/CloudStorage', () => ({
  useGoogleDrive: () => gdriveState,
  useOneDrive: () => onedriveState,
}));

const importMock = vi.fn();
const importUnwrap = vi.fn().mockResolvedValue({ imported_count: 1 });
vi.mock('@/store/publishSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/publishSlice')>();
  return {
    ...actual,
    useImportDriveMutation: () => [
      (args: unknown) => {
        importMock(args);
        return { unwrap: importUnwrap };
      },
      { isLoading: false },
    ],
  };
});

import CloudStorageTab from '../partials/cloud/CloudStorageTab';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const resetProviders = () => {
  Object.assign(gdriveState, makeProviderState());
  Object.assign(onedriveState, makeProviderState());
};

const makeProps = (overrides: Record<string, unknown> = {}) => ({
  activeProvider: 'google_drive' as const,
  onProviderChange: vi.fn(),
  onManageConnections: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CloudStorageTab', () => {
  beforeEach(() => {
    resetProviders();
    importMock.mockClear();
    importUnwrap.mockClear();
  });

  it('provider switcher opens and calls onProviderChange when a provider is chosen', () => {
    const onProviderChange = vi.fn();
    renderWithProviders(
      <CloudStorageTab {...makeProps({ onProviderChange })} />,
    );

    // ProviderSwitcher is rendered as a Chip labelled with the active
    // provider. Clicking it opens the Menu with provider MenuItems.
    fireEvent.click(screen.getByText('Google Drive'));

    // Select the OneDrive MenuItem — the Menu is portaled to document.body,
    // so we query at the screen level.
    const oneDriveOption = screen.getAllByText('OneDrive')[0];
    fireEvent.click(oneDriveOption);

    expect(onProviderChange).toHaveBeenCalledWith('onedrive');
  });

  it('renders the not-connected state when provider is disconnected', () => {
    gdriveState.isConnected = false;
    // isConfigured stays true so the branch resolves to `not_connected`.

    renderWithProviders(<CloudStorageTab {...makeProps()} />);

    // CloudConnectionState renders a "Connect <provider>" heading + CTA.
    // The translation bundle uses "Connect to {{provider}}" — we match on
    // the provider name to stay resilient to the fallback / localised copy.
    expect(
      screen.getByRole('heading', { name: /google drive/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^connect$/i }),
    ).toBeInTheDocument();
  });

  it('renders skeleton loading state while provider is connecting', () => {
    gdriveState.isConnected = false;
    gdriveState.isConnecting = true;

    const { container } = renderWithProviders(
      <CloudStorageTab {...makeProps()} />,
    );

    // CloudConnectionState uses a MUI Skeleton grid for the "loading" status.
    expect(
      container.querySelectorAll('.MuiSkeleton-root').length,
    ).toBeGreaterThan(0);
  });

  it('cloud file card Import button fires the import mutation with the file id', async () => {
    const fileFixture: CloudFile = {
      id: 'file-42',
      name: 'design.png',
      mimeType: 'image/png',
      size: 1024,
      folderPath: '/',
      thumbnailUrl: 'https://cdn.example/thumb.png',
      webContentLink: 'https://cdn.example/download',
    };
    gdriveState.listFolders = vi.fn().mockResolvedValue([]);
    gdriveState.listImages = vi.fn().mockResolvedValue([fileFixture]);

    renderWithProviders(<CloudStorageTab {...makeProps()} />);

    // The tab calls loadFolder(null) on first render (isConnected path). The
    // async list resolves in a microtask — findBy* waits for the file card.
    const card = await screen.findByText('design.png');
    // CloudFileCard's Import IconButton exposes aria-label "Import".
    const cardRoot = card.closest('div') as HTMLElement;
    // Use within(cardRoot) would require climbing past InfoStrip — safest is
    // global getAllByRole because exactly one Import button exists for 1 file.
    const importBtn = within(cardRoot.parentElement as HTMLElement).queryByRole(
      'button',
      { name: /^import$/i },
    )
      ?? screen.getByRole('button', { name: /^import$/i });

    fireEvent.click(importBtn);

    // The mutation is called with the clicked file id + active provider.
    expect(importMock).toHaveBeenCalledWith({
      file_ids: ['file-42'],
      provider: 'google_drive',
    });
  });
});
