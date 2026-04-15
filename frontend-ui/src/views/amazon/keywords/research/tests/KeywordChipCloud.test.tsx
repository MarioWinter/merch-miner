import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import { KeywordChipCloud } from '../partials/KeywordChipCloud';
import type { KeywordSearchResult } from '../types';

const makeResult = (keyword: string, productCount: number | null = null): KeywordSearchResult => ({
  keyword,
  source: 'research',
  in_product_count: 0,
  in_slogan_count: 0,
  js_data: null,
  amazon_product_count: productCount,
  product_count_fetched_at: null,
});

describe('KeywordChipCloud', () => {
  it('renders nothing when results are empty (EC-16)', () => {
    renderWithProviders(
      <KeywordChipCloud results={[]} activeFilter={null} onFilterChange={vi.fn()} />,
    );
    // Collapse renders but is hidden
    expect(screen.queryByText('Short-Tail')).not.toBeInTheDocument();
  });

  it('classifies keywords correctly: <=2 words = Short-Tail, >=3 words = Long-Tail', () => {
    const results = [
      makeResult('cats'),
      makeResult('funny shirts'),
      makeResult('best cat shirts ever'),
    ];
    renderWithProviders(
      <KeywordChipCloud results={results} activeFilter={null} onFilterChange={vi.fn()} />,
    );
    expect(screen.getByText('Short-Tail')).toBeInTheDocument();
    expect(screen.getByText('Long-Tail')).toBeInTheDocument();
    expect(screen.getByText('cats')).toBeInTheDocument();
    expect(screen.getByText('funny shirts')).toBeInTheDocument();
    // Long-tail keyword with product count would show "keyword · count" but without count just keyword
    expect(screen.getByText('best cat shirts ever')).toBeInTheDocument();
  });

  it('shows product count badge when data exists', () => {
    const results = [makeResult('school bus driver', 549)];
    renderWithProviders(
      <KeywordChipCloud results={results} activeFilter={null} onFilterChange={vi.fn()} />,
    );
    // Keyword and product count rendered in separate elements within the chip
    expect(screen.getByText('school bus driver')).toBeInTheDocument();
    expect(screen.getByText('549')).toBeInTheDocument();
  });

  it('calls onFilterChange when chip is clicked', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const results = [makeResult('dogs')];
    renderWithProviders(
      <KeywordChipCloud results={results} activeFilter={null} onFilterChange={onFilterChange} />,
    );
    await user.click(screen.getByText('dogs'));
    expect(onFilterChange).toHaveBeenCalledWith('dogs');
  });

  it('calls onFilterChange with null when active chip is clicked again (toggle off)', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const results = [makeResult('dogs')];
    renderWithProviders(
      <KeywordChipCloud results={results} activeFilter="dogs" onFilterChange={onFilterChange} />,
    );
    await user.click(screen.getByText('dogs'));
    expect(onFilterChange).toHaveBeenCalledWith(null);
  });

  it('shows "Show all" toggle when >12 chips per section', () => {
    const results = Array.from({ length: 15 }, (_, i) => makeResult(`kw${i}`));
    renderWithProviders(
      <KeywordChipCloud results={results} activeFilter={null} onFilterChange={vi.fn()} />,
    );
    // All are 1-word = Short-Tail. Should show +3 more button
    expect(screen.getByText(/\+3 more/)).toBeInTheDocument();
  });

  it('expands and collapses sections on toggle click', async () => {
    const user = userEvent.setup();
    const results = Array.from({ length: 15 }, (_, i) => makeResult(`kw${i}`));
    renderWithProviders(
      <KeywordChipCloud results={results} activeFilter={null} onFilterChange={vi.fn()} />,
    );
    // Initially only 12 visible
    expect(screen.queryByText('kw14')).not.toBeInTheDocument();

    // Click "Show all"
    await user.click(screen.getByText(/\+3 more/));
    expect(screen.getByText('kw14')).toBeInTheDocument();

    // Click "Show less"
    await user.click(screen.getByText('Show less'));
    expect(screen.queryByText('kw14')).not.toBeInTheDocument();
  });
});
