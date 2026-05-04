import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import { SuggestionTabs } from '../partials/SuggestionTabs';
import type { SuggestionCounts } from '../types';

const counts: SuggestionCounts = {
  all: 55,
  listing: 13,
  suggestion: 20,
  after: 10,
  before: 8,
  synonym: 4,
};

describe('SuggestionTabs', () => {
  it('renders all 7 tabs with correct counts', () => {
    renderWithProviders(
      <SuggestionTabs counts={counts} value="all" onChange={vi.fn()} />,
    );
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Listing Keywords')).toBeInTheDocument();
    expect(screen.getByText('Suggestions')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('Synonyms')).toBeInTheDocument();
    expect(screen.getByText('JungleScout')).toBeInTheDocument();
    // Count chips
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('calls onChange with "listing" when Listing Keywords tab clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <SuggestionTabs counts={counts} value="all" onChange={onChange} />,
    );
    await user.click(screen.getByText('Listing Keywords'));
    expect(onChange).toHaveBeenCalledWith('listing');
  });

  it('calls onChange with suggestion source when tab clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <SuggestionTabs counts={counts} value="all" onChange={onChange} />,
    );
    await user.click(screen.getByText('Suggestions'));
    expect(onChange).toHaveBeenCalledWith('suggestion');
  });

  it('calls onChange with "after" when After tab clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <SuggestionTabs counts={counts} value="all" onChange={onChange} />,
    );
    await user.click(screen.getByText('After'));
    expect(onChange).toHaveBeenCalledWith('after');
  });

  it('JungleScout tab is disabled', () => {
    renderWithProviders(
      <SuggestionTabs counts={counts} value="all" onChange={vi.fn()} />,
    );
    const jsTab = screen.getByText('JungleScout').closest('button');
    expect(jsTab).toBeDisabled();
  });

  it('renders zero counts correctly', () => {
    const zeroCounts: SuggestionCounts = {
      all: 0,
      listing: 0,
      suggestion: 0,
      after: 0,
      before: 0,
      synonym: 0,
    };
    renderWithProviders(
      <SuggestionTabs counts={zeroCounts} value="all" onChange={vi.fn()} />,
    );
    // All count chips should show 0 (6 tabs have count chips)
    const chips = screen.getAllByText('0');
    expect(chips.length).toBe(6);
  });

  it('renders Listing Keywords tab with inventory icon', () => {
    renderWithProviders(
      <SuggestionTabs counts={counts} value="all" onChange={vi.fn()} />,
    );
    // The listing tab has an InventoryIcon — verify tab exists with icon
    const listingTab = screen.getByText('Listing Keywords').closest('button');
    expect(listingTab).toBeInTheDocument();
    expect(listingTab).not.toBeDisabled();
    // Icon is rendered as SVG inside the tab
    const svg = listingTab?.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
