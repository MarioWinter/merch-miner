import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { fa } = vi.hoisted(() => ({
  fa: (n: string) => ({ reducerPath: n, reducer: () => ({}), middleware: () => (x: any) => (a: any) => x(a), util: { resetApiState: () => ({ type: 'noop' }) } }),
}));
vi.mock('@/store/nicheSlice', () => ({ nicheApi: fa('nicheApi'), useListNichesQuery: () => ({ data: { results: [] }, isLoading: false }) }));

// Mock RTK mutation
const mockImportIdeas = vi.fn();
vi.mock('@/store/ideaSlice', () => ({
  ideaApi: fa('ideaApi'),
  useImportIdeasMutation: () => [
    (args: unknown) => ({
      unwrap: () => mockImportIdeas(args),
    }),
    { isLoading: false },
  ],
}));

vi.mock('@/store/researchSlice', () => ({ researchApi: fa('researchApi') }));
vi.mock('@/store/designSlice', () => ({ designApi: fa('designApi') }));
vi.mock('@/store/keywordSlice', () => ({ keywordApi: fa('keywordApi') }));
vi.mock('@/store/publishSlice', () => ({ publishApi: fa('publishApi') }));
vi.mock('@/store/dashboardSlice', () => ({ dashboardApi: fa('dashboardApi') }));
vi.mock('@/store/kanbanSlice', () => ({ kanbanApi: fa('kanbanApi') }));
vi.mock('@/store/notificationSlice', () => ({ notificationApi: fa('notificationApi') }));
vi.mock('@/store/searchSlice', () => ({ searchApi: fa('searchApi') }));
vi.mock('@/store/agentSlice', () => ({ agentApi: fa('agentApi') }));
vi.mock('@/store/collectedProductsSlice', () => ({ collectedProductsApi: fa('collectedProductsApi') }));

import { renderWithProviders } from '../../../utils/test-utils';
import { ImportDialog } from '../partials/ImportDialog';

// Mock papaparse
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn((_file: File, opts: { complete: (r: { data: unknown[] }) => void }) => {
      opts.complete({
        data: [
          { slogan_text: 'Test slogan 1', niche_name: 'Dogs' },
          { slogan_text: 'Test slogan 2' },
        ],
      });
    }),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('ImportDialog', () => {
  it('does not render when closed', () => {
    renderWithProviders(
      <ImportDialog open={false} onClose={vi.fn()} />,
    );
    expect(screen.queryByText('Import Ideas')).not.toBeInTheDocument();
  });

  it('renders dialog title when open', () => {
    renderWithProviders(
      <ImportDialog open={true} onClose={vi.fn()} />,
    );
    expect(screen.getByText('Import Ideas')).toBeInTheDocument();
  });

  it('renders drop zone initially', () => {
    renderWithProviders(
      <ImportDialog open={true} onClose={vi.fn()} />,
    );
    expect(
      screen.getByText('Drop a CSV or XLSX file here, or click to browse'),
    ).toBeInTheDocument();
  });

  it('shows supported file types', () => {
    renderWithProviders(
      <ImportDialog open={true} onClose={vi.fn()} />,
    );
    expect(screen.getByText('.csv, .xlsx')).toBeInTheDocument();
  });

  it('renders cancel button', () => {
    renderWithProviders(
      <ImportDialog open={true} onClose={vi.fn()} />,
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <ImportDialog open={true} onClose={onClose} />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows preview table after file is parsed', async () => {
    renderWithProviders(
      <ImportDialog open={true} onClose={vi.fn()} />,
    );

    // Simulate file input
    const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
    const file = new File(['slogan_text\nHello'], 'test.csv', {
      type: 'text/csv',
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Test slogan 1')).toBeInTheDocument();
    });

    // Should show both preview rows
    expect(screen.getByText('Test slogan 2')).toBeInTheDocument();
    // Should show niche column
    expect(screen.getByText('Dogs')).toBeInTheDocument();
  });

  it('shows import confirm button after file parsed', async () => {
    renderWithProviders(
      <ImportDialog open={true} onClose={vi.fn()} />,
    );

    const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Import \(2\)/)).toBeInTheDocument();
    });
  });

  it('shows reset button after file parsed', async () => {
    renderWithProviders(
      <ImportDialog open={true} onClose={vi.fn()} />,
    );

    const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Reset')).toBeInTheDocument();
    });
  });
});
