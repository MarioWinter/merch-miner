import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import { NicheSummaryCard } from '../partials/NicheSummaryCard';
import type { NicheAnalysis } from '../types';

const analysis: NicheAnalysis = {
  niche_summary: 'Hiking enthusiasts love humorous identity-driven slogans.',
  sentiment: 'Positive',
  primary_emotions: ['Pride', 'Humor', 'Belonging'],
  emotional_archetype: ['The Explorer', 'The Jester'],
  example_keywords: ['hiking', 'mountains', 'trail'],
  pattern_analysis: [],
  emotional_reality: 'Customers buy identity validation through outdoor humor.',
  design_concepts: 'Bold typography with nature silhouettes.',
  dominant_design_aesthetics: 'Earth tones, distressed fonts, mountain vectors.',
};

describe('NicheSummaryCard', () => {
  it('renders summary text', () => {
    renderWithProviders(<NicheSummaryCard analysis={analysis} />);
    expect(screen.getByText(analysis.niche_summary)).toBeInTheDocument();
  });

  it('renders sentiment chip', () => {
    renderWithProviders(<NicheSummaryCard analysis={analysis} />);
    expect(screen.getByText('Positive')).toBeInTheDocument();
  });

  it('renders emotion chips', () => {
    renderWithProviders(<NicheSummaryCard analysis={analysis} />);
    expect(screen.getByText('Pride')).toBeInTheDocument();
    expect(screen.getByText('Humor')).toBeInTheDocument();
    expect(screen.getByText('Belonging')).toBeInTheDocument();
  });

  it('renders archetypes', () => {
    renderWithProviders(<NicheSummaryCard analysis={analysis} />);
    expect(screen.getByText('The Explorer')).toBeInTheDocument();
    expect(screen.getByText('The Jester')).toBeInTheDocument();
  });

  it('renders emotional reality and design sections', () => {
    renderWithProviders(<NicheSummaryCard analysis={analysis} />);
    expect(screen.getByText(analysis.emotional_reality)).toBeInTheDocument();
    expect(screen.getByText(analysis.design_concepts)).toBeInTheDocument();
    expect(screen.getByText(analysis.dominant_design_aesthetics)).toBeInTheDocument();
  });
});
