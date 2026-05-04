import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type { ExportHistoryResponse, ExportLog } from '../types';

// ---------------------------------------------------------------------------
// Mocks — stub the RTK list-history query. The drawer also mounts
// ExportPreflightDialog for the re-run flow; we stub it to a dumb marker so
// we can assert it was instantiated with the right log.
// ---------------------------------------------------------------------------

let listResult: {
  data?: ExportHistoryResponse;
  isLoading: boolean;
} = { data: undefined, isLoading: false };

vi.mock('@/store/publishSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/publishSlice')>();
  return {
    ...actual,
    useListExportHistoryQuery: () => listResult,
  };
});

// Mock the dialog so we don't exercise its preflight path.
const dialogProbe = vi.fn();
vi.mock('../partials/export/ExportPreflightDialog', () => ({
  default: (props: { template: string; format: string; designIds: string[] }) => {
    dialogProbe(props);
    return (
      <div data-testid="rerun-dialog">
        {props.template}:{props.format}:{props.designIds.join(',')}
      </div>
    );
  },
}));

import ExportHistoryDrawer from '../partials/export/ExportHistoryDrawer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeLog = (overrides: Partial<ExportLog> = {}): ExportLog => ({
  id: 'log-1',
  template: 'mba',
  format: 'xlsx',
  design_count: 3,
  row_count: 7,
  design_ids: ['d1', 'd2', 'd3'],
  filename: 'mba_2026-04-24.xlsx',
  output_size_bytes: 123456,
  // 3 days ago — formatRelativeTime should emit "3 days ago".
  created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
  created_by: {
    id: 'u1',
    first_name: 'Alex',
    last_name: 'Doe',
    avatar_url: '',
  },
  ...overrides,
});

const makeResponse = (
  rows: ExportLog[],
): ExportHistoryResponse => ({
  count: rows.length,
  next: null,
  previous: null,
  results: rows,
});

// ---------------------------------------------------------------------------
// Tests — Phase W5 + W6
// ---------------------------------------------------------------------------

describe('ExportHistoryDrawer', () => {
  beforeEach(() => {
    listResult = { data: undefined, isLoading: false };
    dialogProbe.mockReset();
  });

  it('renders the empty state when no logs exist', async () => {
    listResult = { data: makeResponse([]), isLoading: false };
    renderWithProviders(<ExportHistoryDrawer open onClose={vi.fn()} />);
    expect(await screen.findByTestId('ExportHistory-empty')).toBeInTheDocument();
  });

  it('renders a row per log with filename, template chip, and counts', async () => {
    const rows = [
      makeLog(),
      makeLog({ id: 'log-2', filename: 'basic.csv', template: 'basic', format: 'csv' }),
    ];
    listResult = { data: makeResponse(rows), isLoading: false };

    renderWithProviders(<ExportHistoryDrawer open onClose={vi.fn()} />);

    const items = await screen.findAllByTestId('ExportHistory-row');
    expect(items).toHaveLength(2);
    expect(screen.getByText('mba_2026-04-24.xlsx')).toBeInTheDocument();
    expect(screen.getByText('basic.csv')).toBeInTheDocument();
    expect(screen.getByText(/MBA · XLSX/i)).toBeInTheDocument();
    expect(screen.getByText(/BASIC · CSV/i)).toBeInTheDocument();
  });

  it('rerun tooltip label includes the relative timestamp (W6)', async () => {
    listResult = { data: makeResponse([makeLog()]), isLoading: false };
    renderWithProviders(<ExportHistoryDrawer open onClose={vi.fn()} />);

    const btn = await screen.findByTestId('ExportHistory-rerun');
    const label = btn.getAttribute('aria-label') ?? '';
    // "Re-run export (3 days ago)" — assert both halves without hard-coding
    // the exact day count in case the harness runs around midnight.
    expect(label).toMatch(/Re-run export/i);
    expect(label).toMatch(/ago\)/);
  });

  it('clicking the rerun button mounts ExportPreflightDialog with the log template/format/ids', async () => {
    const log = makeLog();
    listResult = { data: makeResponse([log]), isLoading: false };

    renderWithProviders(<ExportHistoryDrawer open onClose={vi.fn()} />);
    const btn = await screen.findByTestId('ExportHistory-rerun');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(dialogProbe).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'mba',
          format: 'xlsx',
          designIds: ['d1', 'd2', 'd3'],
        }),
      );
    });
    expect(screen.getByTestId('rerun-dialog')).toBeInTheDocument();
  });

  it('shows a loading placeholder while isLoading is true', () => {
    listResult = { data: undefined, isLoading: true };
    renderWithProviders(<ExportHistoryDrawer open onClose={vi.fn()} />);
    expect(screen.queryByTestId('ExportHistory-empty')).not.toBeInTheDocument();
  });
});
