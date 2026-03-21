import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import { PatternGrid } from '../partials/PatternGrid';
import type { PatternItem } from '../types';

const makePatterns = (activeCount: number): PatternItem[] => {
  const names = [
    'IDENTITY_DECLARATION', 'GROUP_LEADER', 'TRIBE_COMMUNITY', 'FUNNY_ACTIVITY',
    'CROSS_NICHE_EVENTS', 'CROSS_NICHE_MASHUP', 'ADDICTION_OBSESSION', 'VINTAGE_LEGACY',
    'ACHIEVEMENT_GAMIFIED', 'JOB_PROFESSION_PARODY', 'RELATIONSHIP_HUMOR', 'BOUNDARY_GATEKEEPING',
    'ENDURANCE_SURVIVAL', 'COMPETENCE_EXPERTISE', 'CHAOS_CONTROL', 'SELF_CARE_PRIORITIES',
  ] as const;
  return names.map((name, i) => ({
    name,
    present: i < activeCount,
    context: i < activeCount ? `Context for ${name}` : '',
  }));
};

describe('PatternGrid', () => {
  it('renders active patterns visibly and hides inactive by default', () => {
    const patterns = makePatterns(3);
    renderWithProviders(<PatternGrid patterns={patterns} />);

    // Active patterns visible
    expect(screen.getByText('Identity Declaration')).toBeInTheDocument();
    expect(screen.getByText('Group Leader')).toBeInTheDocument();
    expect(screen.getByText('Tribe / Community')).toBeInTheDocument();

    // Inactive patterns hidden
    expect(screen.queryByText('Funny Activity')).not.toBeInTheDocument();
  });

  it('shows inactive patterns when toggle clicked', async () => {
    const user = userEvent.setup();
    const patterns = makePatterns(2);
    renderWithProviders(<PatternGrid patterns={patterns} />);

    const toggleBtn = screen.getByRole('button', { name: /show inactive/i });
    await user.click(toggleBtn);

    expect(screen.getByText('Funny Activity')).toBeInTheDocument();
  });

  it('displays the correct active count', () => {
    const patterns = makePatterns(5);
    renderWithProviders(<PatternGrid patterns={patterns} />);

    expect(screen.getByText('5 active')).toBeInTheDocument();
  });
});
