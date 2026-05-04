import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import { SearchHistoryChips, type RecentSearchEntry } from '@/components/SearchHistory/SearchHistoryChips';

const mockSearches: RecentSearchEntry[] = [
  { keyword: 'funny shirts', marketplace: 'amazon_com' },
  { keyword: 'cat lover', marketplace: 'amazon_de' },
];

describe('SearchHistoryChips', () => {
  it('renders nothing when searches array is empty', () => {
    const { container } = renderWithProviders(
      <SearchHistoryChips
        searches={[]}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders chips for each search', () => {
    renderWithProviders(
      <SearchHistoryChips
        searches={mockSearches}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.getByText('funny shirts')).toBeInTheDocument();
    expect(screen.getByText('cat lover')).toBeInTheDocument();
  });

  it('calls onSelect with keyword and marketplace when chip is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <SearchHistoryChips
        searches={mockSearches}
        onSelect={onSelect}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    await user.click(screen.getByText('funny shirts'));
    expect(onSelect).toHaveBeenCalledWith('funny shirts', 'amazon_com');
  });

  it('calls onRemove when delete icon is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderWithProviders(
      <SearchHistoryChips
        searches={mockSearches}
        onSelect={vi.fn()}
        onRemove={onRemove}
        onClearAll={vi.fn()}
      />,
    );
    // Custom CloseIcon used as deleteIcon
    const deleteIcons = screen.getAllByTestId('CloseIcon');
    await user.click(deleteIcons[0]);
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('calls onClearAll when clear all button is clicked', async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    renderWithProviders(
      <SearchHistoryChips
        searches={mockSearches}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        onClearAll={onClearAll}
      />,
    );
    await user.click(screen.getByText('Clear all'));
    expect(onClearAll).toHaveBeenCalled();
  });
});
