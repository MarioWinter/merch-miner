import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type { FlyingUploadPreviewResponse } from '../types';

// ---------------------------------------------------------------------------
// Mocks — stub `useExport` (our own hook) so we don't exercise the RTK +
// timeout machinery from the dialog's render path. Also stub notistack so
// the dialog's `onClose` doesn't try to push a snackbar.
// ---------------------------------------------------------------------------

const preflightMock = vi.fn();
const downloadMock = vi.fn();
let isPreflighting = false;
let isDownloading = false;

vi.mock('../hooks/useExport', () => ({
  useExport: () => ({
    preflight: preflightMock,
    download: downloadMock,
    isPreflighting,
    isDownloading,
  }),
  DOWNLOAD_TIMEOUT_MS: 60_000,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import ExportPreflightDialog from '../partials/export/ExportPreflightDialog';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeSummary = (
  overrides: Partial<FlyingUploadPreviewResponse> = {},
): FlyingUploadPreviewResponse => ({
  total_designs: 3,
  ready_rows: 2,
  skipped: [{ design_id: 'd3', reason: 'no_listing' }],
  warnings: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests — Phase W2
// ---------------------------------------------------------------------------

describe('ExportPreflightDialog', () => {
  beforeEach(() => {
    preflightMock.mockReset();
    downloadMock.mockReset();
    mockNavigate.mockReset();
    isPreflighting = false;
    isDownloading = false;
  });

  it('runs preflight on open and renders the ready/total/skipped counts', async () => {
    preflightMock.mockResolvedValue(makeSummary());

    renderWithProviders(
      <ExportPreflightDialog
        open
        template="mba"
        format="xlsx"
        designIds={['d1', 'd2', 'd3']}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(preflightMock).toHaveBeenCalledWith({
        template: 'mba',
        format: 'xlsx',
        design_ids: ['d1', 'd2', 'd3'],
      });
    });

    expect(await screen.findByText(/2 ready/i)).toBeInTheDocument();
    expect(screen.getByText(/3 total/i)).toBeInTheDocument();
    expect(screen.getByText(/1 skipped/i)).toBeInTheDocument();
  });

  it('disables the Download button when ready_rows is 0', async () => {
    preflightMock.mockResolvedValue(
      makeSummary({
        ready_rows: 0,
        skipped: [
          { design_id: 'd1', reason: 'no_listing' },
          { design_id: 'd2', reason: 'no_listing' },
        ],
      }),
    );

    renderWithProviders(
      <ExportPreflightDialog
        open
        template="mba"
        format="xlsx"
        designIds={['d1', 'd2']}
        onClose={vi.fn()}
      />,
    );

    const btn = await screen.findByTestId('ExportPreflight-download');
    expect(btn).toBeDisabled();
  });

  it('shows an "Edit N" button for no_listing rows and navigates on click', async () => {
    preflightMock.mockResolvedValue(
      makeSummary({
        skipped: [
          { design_id: 'd1', reason: 'no_listing' },
          { design_id: 'd2', reason: 'no_listing' },
        ],
      }),
    );

    renderWithProviders(
      <ExportPreflightDialog
        open
        template="mba"
        format="xlsx"
        designIds={['d1', 'd2', 'd3']}
        onClose={vi.fn()}
      />,
    );

    const editBtn = await screen.findByTestId(
      'ExportPreflight-edit-no_listing',
    );
    fireEvent.click(editBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/publish/edit?designs=d1,d2');
  });

  it('suppresses the "Edit 1" quick-fix when the only skipped id matches currentDesignId (EC-81)', async () => {
    preflightMock.mockResolvedValue(
      makeSummary({
        skipped: [{ design_id: 'd1', reason: 'no_listing' }],
      }),
    );

    renderWithProviders(
      <ExportPreflightDialog
        open
        template="mba"
        format="xlsx"
        designIds={['d1']}
        currentDesignId="d1"
        onClose={vi.fn()}
      />,
    );

    await screen.findByText(/1 skipped/i);
    expect(
      screen.queryByTestId('ExportPreflight-edit-no_listing'),
    ).not.toBeInTheDocument();
  });

  it('does NOT render an Edit button for reasons outside the edit-eligible set', async () => {
    preflightMock.mockResolvedValue(
      makeSummary({
        ready_rows: 0,
        skipped: [
          { design_id: 'd1', reason: 'image_unavailable' },
          { design_id: 'd2', reason: 'catalog_unknown_product' },
        ],
      }),
    );

    renderWithProviders(
      <ExportPreflightDialog
        open
        template="mba"
        format="xlsx"
        designIds={['d1', 'd2']}
        onClose={vi.fn()}
      />,
    );

    await screen.findByText(/2 skipped/i);
    expect(
      screen.queryByTestId('ExportPreflight-edit-image_unavailable'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ExportPreflight-edit-catalog_unknown_product'),
    ).not.toBeInTheDocument();
  });

  it('calls download + onClose when the Download button is clicked and the download succeeds', async () => {
    preflightMock.mockResolvedValue(makeSummary());
    downloadMock.mockResolvedValue(true);
    const onClose = vi.fn();

    renderWithProviders(
      <ExportPreflightDialog
        open
        template="mba"
        format="xlsx"
        designIds={['d1', 'd2', 'd3']}
        onClose={onClose}
      />,
    );

    const btn = await screen.findByTestId('ExportPreflight-download');
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);

    await waitFor(() =>
      expect(downloadMock).toHaveBeenCalledWith({
        template: 'mba',
        format: 'xlsx',
        design_ids: ['d1', 'd2', 'd3'],
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
