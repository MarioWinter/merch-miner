import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import SloganPoolCard from '../partials/rightPanel/SloganPoolCard';
import type { ProjectIdea } from '../../gallery/types';

// ── Fixtures ───────────────────────────────────────────────────────
const makeIdea = (overrides?: Partial<ProjectIdea>): ProjectIdea => ({
  id: 'idea-1',
  slogan_text: 'School bus drivers make the best teachers',
  signal_type: 'self',
  market_confidence: 'high',
  emotional_archetype: 'Proud Professional',
  pattern_used: 'Identity Pride',
  why_it_works: 'Appeals to professional identity',
  niche_name: 'school bus driver',
  position: 0,
  reference_products: [],
  design_count: 0,
  ...overrides,
});

// ── Tests ──────────────────────────────────────────────────────────
describe('SloganPoolCard', () => {
  const defaultProps = {
    onInsertSlogan: vi.fn(),
    onRemove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders slogan text', () => {
    renderWithProviders(
      <SloganPoolCard {...defaultProps} idea={makeIdea()} />,
    );
    expect(screen.getByText('School bus drivers make the best teachers')).toBeInTheDocument();
  });

  it('renders signal_type badge', () => {
    renderWithProviders(
      <SloganPoolCard {...defaultProps} idea={makeIdea()} />,
    );
    expect(screen.getByText('SELF')).toBeInTheDocument();
  });

  it('renders niche chip', () => {
    renderWithProviders(
      <SloganPoolCard {...defaultProps} idea={makeIdea()} />,
    );
    expect(screen.getByText('school bus driver')).toBeInTheDocument();
  });

  it('calls onInsertSlogan with slogan text when insert button clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SloganPoolCard {...defaultProps} idea={makeIdea()} />,
    );
    const insertBtn = screen.getByLabelText('Insert into prompt');
    await user.click(insertBtn);
    expect(defaultProps.onInsertSlogan).toHaveBeenCalledWith(
      'School bus drivers make the best teachers',
    );
  });

  it('calls onRemove when remove button clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SloganPoolCard {...defaultProps} idea={makeIdea()} />,
    );
    const removeBtn = screen.getByLabelText('Remove');
    await user.click(removeBtn);
    expect(defaultProps.onRemove).toHaveBeenCalled();
  });

  it('does not render checkbox', () => {
    renderWithProviders(
      <SloganPoolCard {...defaultProps} idea={makeIdea()} />,
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows expandable details', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SloganPoolCard {...defaultProps} idea={makeIdea()} />,
    );
    // Click details accordion
    const detailsBtn = screen.getByText('Details');
    await user.click(detailsBtn);
    expect(screen.getByText('Appeals to professional identity')).toBeInTheDocument();
    expect(screen.getByText('Proud Professional')).toBeInTheDocument();
    expect(screen.getByText('Identity Pride')).toBeInTheDocument();
  });
});
