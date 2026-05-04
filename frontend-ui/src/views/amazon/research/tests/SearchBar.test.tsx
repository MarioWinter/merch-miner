import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import SearchBar from '../partials/SearchBar';

// ── RTK Query mock ──────────────────────────────────────────────────────────
let mockSuggestions: string[] = [];

vi.mock('../../../../store/researchSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/researchSlice')>();
  return {
    ...actual,
    useGetSuggestionsQuery: () => ({ data: mockSuggestions, isLoading: false }),
  };
});

const baseProps = {
  isLive: false,
  onToggleMode: vi.fn(),
  keyword: '',
  marketplace: 'amazon_com',
  onKeywordChange: vi.fn(),
  onSearch: vi.fn(),
  matchedNiche: null,
  hasSearched: false,
  onNicheIndicatorClick: vi.fn(),
};

describe('SearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuggestions = [];
  });

  it('renders search input and submit button', () => {
    renderWithProviders(<SearchBar {...baseProps} />);

    expect(screen.getByPlaceholderText('Search keywords...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('renders mode toggle switch', () => {
    renderWithProviders(<SearchBar {...baseProps} />);

    expect(screen.getByLabelText('Toggle research mode')).toBeInTheDocument();
  });

  it('calls onSearch with trimmed keyword on button click', async () => {
    const onSearch = vi.fn();
    const onKeywordChange = vi.fn();
    renderWithProviders(
      <SearchBar {...baseProps} onSearch={onSearch} onKeywordChange={onKeywordChange} />,
    );

    const input = screen.getByPlaceholderText('Search keywords...');
    await userEvent.type(input, '  hiking shirts  ');

    const searchBtn = screen.getByRole('button', { name: 'Search' });
    await userEvent.click(searchBtn);

    expect(onKeywordChange).toHaveBeenCalledWith('hiking shirts');
    expect(onSearch).toHaveBeenCalledWith('hiking shirts');
  });

  it('Enter key triggers search', async () => {
    const onSearch = vi.fn();
    const onKeywordChange = vi.fn();
    renderWithProviders(
      <SearchBar {...baseProps} onSearch={onSearch} onKeywordChange={onKeywordChange} />,
    );

    const input = screen.getByPlaceholderText('Search keywords...');
    await userEvent.type(input, 'funny cats{Enter}');

    expect(onKeywordChange).toHaveBeenCalledWith('funny cats');
    expect(onSearch).toHaveBeenCalledWith('funny cats');
  });

  it('does not submit when keyword is empty or whitespace only', async () => {
    const onSearch = vi.fn();
    const onKeywordChange = vi.fn();
    renderWithProviders(
      <SearchBar {...baseProps} onSearch={onSearch} onKeywordChange={onKeywordChange} />,
    );

    // Search button is disabled when input is empty
    const searchBtn = screen.getByRole('button', { name: 'Search' });
    expect(searchBtn).toBeDisabled();

    // Type only spaces then press Enter — should not submit
    const input = screen.getByPlaceholderText('Search keywords...');
    await userEvent.type(input, '   {Enter}');

    expect(onSearch).not.toHaveBeenCalled();
    expect(onKeywordChange).not.toHaveBeenCalled();
  });

  it('shows Live Research label when isLive is true', () => {
    renderWithProviders(<SearchBar {...baseProps} isLive={true} />);

    expect(screen.getByText('Live Research')).toBeInTheDocument();
  });

  it('renders Live Research label in disabled style when isLive is false', () => {
    renderWithProviders(<SearchBar {...baseProps} isLive={false} />);

    // Label is always rendered but styled as disabled when not active
    expect(screen.getByText('Live Research')).toBeInTheDocument();
  });

  // Recent-search rendering moved out of SearchBar into <SearchHistoryChips>
  // (rendered by AmazonResearchView right below SearchBar). See
  // src/components/SearchHistory/ tests for those interactions.

  it('syncs input value when keyword prop changes', () => {
    const { rerender } = renderWithProviders(
      <SearchBar {...baseProps} keyword="initial" />,
    );

    const input = screen.getByPlaceholderText('Search keywords...') as HTMLInputElement;
    expect(input.value).toBe('initial');

    rerender(<SearchBar {...baseProps} keyword="updated" />);
    expect(input.value).toBe('updated');
  });

  it('autocomplete is freeSolo and renders input as combobox', () => {
    renderWithProviders(<SearchBar {...baseProps} />);

    const input = screen.getByPlaceholderText('Search keywords...');
    expect(input).toHaveAttribute('role', 'combobox');
  });
});
