import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import { KeywordTable } from '../partials/KeywordTable';
import { DEFAULT_COLUMN_VISIBILITY } from '../types';
import type { KeywordSearchResult } from '../types';

// Mock RTK Query mutation used by KeywordTable
vi.mock('@/store/keywordSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/keywordSlice')>();
  return {
    ...actual,
    useScrapeProductCountMutation: () => [vi.fn(), { isLoading: false }],
  };
});

const makeRow = (keyword: string): KeywordSearchResult => ({
  keyword,
  source: 'suggestion',
  in_product_count: 0,
  in_slogan_count: 0,
  js_data: null,
  amazon_product_count: null,
  product_count_fetched_at: null,
});

const defaultProps = {
  rows: [makeRow('camping shirt'), makeRow('hiking shirt')],
  totalCount: 2,
  page: 1,
  pageSize: 25,
  onPageChange: vi.fn(),
  columnVisibility: DEFAULT_COLUMN_VISIBILITY,
  isLoading: false,
  selectedKeywords: [],
  onSelectionChange: vi.fn(),
  onEnrichSingle: vi.fn(),
  isEnriching: () => false,
  onKeywordClick: vi.fn(),
  onSearchKeyword: vi.fn(),
  marketplace: 'amazon_com',
};

describe('KeywordTable', () => {
  let writeTextSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom may not have clipboard — create it if needed, then spy on writeText
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn() },
        writable: true,
        configurable: true,
      });
    }
    writeTextSpy = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);
  });

  it('renders rows with keyword text', () => {
    renderWithProviders(<KeywordTable {...defaultProps} />);
    expect(screen.getByText('camping shirt')).toBeInTheDocument();
    expect(screen.getByText('hiking shirt')).toBeInTheDocument();
  });

  it('shows skeleton loading state when isLoading is true', () => {
    const { container } = renderWithProviders(
      <KeywordTable {...defaultProps} isLoading />,
    );
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('copy icon calls navigator.clipboard.writeText with the keyword', async () => {
    const { fireEvent } = await import('@testing-library/react');
    renderWithProviders(<KeywordTable {...defaultProps} />);

    const row = screen.getByText('camping shirt').closest('.MuiDataGrid-row');
    expect(row).toBeTruthy();

    const copyBtn = within(row!).getAllByRole('button').find((btn) =>
      btn.querySelector('[data-testid="ContentCopyIcon"]'),
    );
    expect(copyBtn).toBeTruthy();
    fireEvent.click(copyBtn!);

    // Allow the async clipboard call + snackbar state update to flush
    await new Promise((r) => setTimeout(r, 50));

    expect(writeTextSpy).toHaveBeenCalledWith('camping shirt');
  });

  it('search icon calls onSearchKeyword with the keyword', async () => {
    const user = userEvent.setup();
    const onSearchKeyword = vi.fn();
    renderWithProviders(
      <KeywordTable {...defaultProps} onSearchKeyword={onSearchKeyword} />,
    );

    const row = screen.getByText('camping shirt').closest('.MuiDataGrid-row');
    const searchBtn = within(row!).getAllByRole('button').find((btn) =>
      btn.querySelector('[data-testid="SearchIcon"]'),
    );
    expect(searchBtn).toBeTruthy();
    await user.click(searchBtn!);

    expect(onSearchKeyword).toHaveBeenCalledWith('camping shirt');
  });

  it('renders EnrichButton in actions column', () => {
    renderWithProviders(<KeywordTable {...defaultProps} />);

    const row = screen.getByText('camping shirt').closest('.MuiDataGrid-row');
    // EnrichButton renders AutoAwesomeIcon
    const enrichIcon = within(row!).getByTestId('AutoAwesomeIcon');
    expect(enrichIcon).toBeInTheDocument();
  });
});
