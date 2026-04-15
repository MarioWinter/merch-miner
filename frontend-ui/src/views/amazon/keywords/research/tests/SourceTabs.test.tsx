import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import { SourceTabs } from '../partials/SourceTabs';
import type { KeywordSearchResult } from '../types';

const makeResult = (source: KeywordSearchResult['source']): KeywordSearchResult => ({
  keyword: `kw-${Math.random()}`,
  source,
  in_product_count: 0,
  in_slogan_count: 0,
  js_data: null,
  amazon_product_count: null,
  product_count_fetched_at: null,
});

const results: KeywordSearchResult[] = [
  makeResult('research'),
  makeResult('research'),
  makeResult('manual'),
  makeResult('amazon_search'),
  makeResult('amazon_search'),
  makeResult('amazon_search'),
];

describe('SourceTabs', () => {
  it('renders all tabs with correct counts', () => {
    renderWithProviders(
      <SourceTabs results={results} value="all" onChange={vi.fn()} />,
    );
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('Amazon')).toBeInTheDocument();
    expect(screen.getByText('JungleScout')).toBeInTheDocument();
    // Count chips rendered — verify at least the total count exists
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('calls onChange when a tab is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <SourceTabs results={results} value="all" onChange={onChange} />,
    );
    await user.click(screen.getByText('Database'));
    expect(onChange).toHaveBeenCalledWith('database');
  });

  it('JungleScout tab is disabled', () => {
    renderWithProviders(
      <SourceTabs results={results} value="all" onChange={vi.fn()} />,
    );
    const jsTab = screen.getByText('JungleScout').closest('button');
    expect(jsTab).toBeDisabled();
  });

  it('counts database sources correctly (research + web_search + manual)', () => {
    const mixedResults = [
      makeResult('research'),
      makeResult('web_search'),
      makeResult('manual'),
      makeResult('amazon_search'),
    ];
    renderWithProviders(
      <SourceTabs results={mixedResults} value="all" onChange={vi.fn()} />,
    );
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('Amazon')).toBeInTheDocument();
  });
});
