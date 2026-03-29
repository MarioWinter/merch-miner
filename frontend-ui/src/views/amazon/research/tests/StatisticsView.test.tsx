import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import StatisticsView from '../partials/StatisticsView';
import type { SearchKeywordResult } from '../types';

const mockKeywordResults: SearchKeywordResult = {
  top_focus_keywords: [
    { keyword: 'hiking', frequency: 15 },
    { keyword: 'funny', frequency: 10 },
  ],
  top_long_tail_keywords: [
    { keyword: 'funny hiking shirt', frequency: 8 },
    { keyword: 'outdoor adventure tee', frequency: 4 },
  ],
};

describe('StatisticsView', () => {
  it('shows empty state when no search has been done', () => {
    renderWithProviders(
      <StatisticsView
        keywordResults={undefined}
        hasSearched={false}
        onKeywordClick={vi.fn()}
      />,
    );

    expect(screen.getByText('Run a search first')).toBeInTheDocument();
    expect(
      screen.getByText('Keyword statistics will appear after a search completes'),
    ).toBeInTheDocument();
  });

  it('shows no data state when search done but no keywords', () => {
    renderWithProviders(
      <StatisticsView
        keywordResults={{ top_focus_keywords: [], top_long_tail_keywords: [] }}
        hasSearched={true}
        onKeywordClick={vi.fn()}
      />,
    );

    expect(screen.getByText('No keyword data available')).toBeInTheDocument();
  });

  it('renders focus and long-tail keyword chips', () => {
    renderWithProviders(
      <StatisticsView
        keywordResults={mockKeywordResults}
        hasSearched={true}
        onKeywordClick={vi.fn()}
      />,
    );

    expect(screen.getByText('hiking')).toBeInTheDocument();
    expect(screen.getByText('funny')).toBeInTheDocument();
    expect(screen.getByText('funny hiking shirt')).toBeInTheDocument();
    expect(screen.getByText('outdoor adventure tee')).toBeInTheDocument();
    // Count only shown when frequency > 1
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('calls onKeywordClick when chip is clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    renderWithProviders(
      <StatisticsView
        keywordResults={mockKeywordResults}
        hasSearched={true}
        onKeywordClick={handleClick}
      />,
    );

    await user.click(screen.getByText('hiking'));
    expect(handleClick).toHaveBeenCalledWith('hiking');
  });
});
