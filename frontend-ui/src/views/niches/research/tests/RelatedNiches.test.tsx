import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import { RelatedNiches } from '../partials/RelatedNiches';
import type { RelatedNiche } from '../types';

const niches: RelatedNiche[] = [
  { id: '1', name: 'Fishing Gifts', shared_patterns: ['IDENTITY_DECLARATION', 'TRIBE_COMMUNITY'] },
  { id: '2', name: 'Camping Humor', shared_patterns: ['FUNNY_ACTIVITY', 'ADDICTION_OBSESSION'] },
];

describe('RelatedNiches', () => {
  it('renders related niche names and shared pattern badges', () => {
    renderWithProviders(<RelatedNiches niches={niches} />);

    expect(screen.getByText('Fishing Gifts')).toBeInTheDocument();
    expect(screen.getByText('Camping Humor')).toBeInTheDocument();
    expect(screen.getByText('IDENTITY DECLARATION')).toBeInTheDocument();
    expect(screen.getByText('TRIBE COMMUNITY')).toBeInTheDocument();
  });

  it('renders empty state when no related niches', () => {
    renderWithProviders(<RelatedNiches niches={[]} />);

    expect(screen.getByText(/no related niches/i)).toBeInTheDocument();
  });
});
