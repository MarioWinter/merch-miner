import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import { KeywordChips } from '../partials/KeywordChips';
import type { NicheKeywords } from '../types';

const keywords: NicheKeywords = {
  main_short_tail: ['hiking', 'outdoor'],
  main_long_tail: ['hiking gifts for men', 'outdoor lover presents'],
  all_keywords_flat: 'hiking, outdoor, gifts, men, presents',
  top_focus_keywords: ['hiking gifts', 'outdoor gifts'],
  top_long_tail_keywords: ['funny hiking t-shirt for dad'],
};

describe('KeywordChips', () => {
  it('renders all keyword sections', () => {
    renderWithProviders(<KeywordChips keywords={keywords} />);

    expect(screen.getByText('hiking')).toBeInTheDocument();
    expect(screen.getByText('outdoor')).toBeInTheDocument();
    expect(screen.getByText('hiking gifts for men')).toBeInTheDocument();
    expect(screen.getByText('hiking gifts')).toBeInTheDocument();
    expect(screen.getByText('funny hiking t-shirt for dad')).toBeInTheDocument();
    expect(screen.getByText('hiking, outdoor, gifts, men, presents')).toBeInTheDocument();
  });

  it('hides empty sections', () => {
    const emptyKeywords: NicheKeywords = {
      main_short_tail: [],
      main_long_tail: [],
      all_keywords_flat: '',
      top_focus_keywords: ['test keyword'],
      top_long_tail_keywords: [],
    };
    renderWithProviders(<KeywordChips keywords={emptyKeywords} />);

    expect(screen.getByText('test keyword')).toBeInTheDocument();
    // Short-tail section label should not render
    expect(screen.queryByText('Short-Tail')).not.toBeInTheDocument();
  });
});
