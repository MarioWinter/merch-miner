import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import StarRatingFilter from '../partials/StarRatingFilter';

const baseProps = {
  value: 0,
  onChange: vi.fn(),
};

describe('StarRatingFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Min. Rating" label', () => {
    renderWithProviders(<StarRatingFilter {...baseProps} />);

    expect(screen.getByText('Min. Rating')).toBeInTheDocument();
  });

  it('renders 5 star buttons', () => {
    renderWithProviders(<StarRatingFilter {...baseProps} />);

    for (let i = 1; i <= 5; i++) {
      expect(
        screen.getByRole('button', { name: `Set minimum rating to ${i}` }),
      ).toBeInTheDocument();
    }
  });

  it('clicking a star calls onChange with that star number', async () => {
    const onChange = vi.fn();
    renderWithProviders(<StarRatingFilter value={0} onChange={onChange} />);

    const star3 = screen.getByRole('button', { name: 'Set minimum rating to 3' });
    await userEvent.click(star3);

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('clicking the currently selected star deselects (calls onChange with 0)', async () => {
    const onChange = vi.fn();
    renderWithProviders(<StarRatingFilter value={4} onChange={onChange} />);

    const star4 = screen.getByRole('button', { name: 'Set minimum rating to 4' });
    await userEvent.click(star4);

    // value === star => toggles to 0
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('clicking a different star than the selected one calls onChange with new star', async () => {
    const onChange = vi.fn();
    renderWithProviders(<StarRatingFilter value={3} onChange={onChange} />);

    const star5 = screen.getByRole('button', { name: 'Set minimum rating to 5' });
    await userEvent.click(star5);

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('shows "N+ stars" text when a rating is selected', () => {
    renderWithProviders(<StarRatingFilter value={3} onChange={vi.fn()} />);

    expect(screen.getByText('3+ stars')).toBeInTheDocument();
  });

  it('does not show "N+ stars" text when no rating is selected', () => {
    renderWithProviders(<StarRatingFilter value={0} onChange={vi.fn()} />);

    expect(screen.queryByText(/\d\+ stars/)).not.toBeInTheDocument();
  });

  it('renders filled star icons up to the selected value', () => {
    renderWithProviders(<StarRatingFilter value={3} onChange={vi.fn()} />);

    // Stars 1-3 should be filled (StarIcon), 4-5 should be outlined (StarBorderIcon)
    const filledStars = document.querySelectorAll('[data-testid="StarIcon"]');
    const borderStars = document.querySelectorAll('[data-testid="StarBorderIcon"]');

    expect(filledStars.length).toBe(3);
    expect(borderStars.length).toBe(2);
  });

  it('renders all stars as outlined when value is 0', () => {
    renderWithProviders(<StarRatingFilter value={0} onChange={vi.fn()} />);

    const filledStars = document.querySelectorAll('[data-testid="StarIcon"]');
    const borderStars = document.querySelectorAll('[data-testid="StarBorderIcon"]');

    expect(filledStars.length).toBe(0);
    expect(borderStars.length).toBe(5);
  });

  it('renders all stars as filled when value is 5', () => {
    renderWithProviders(<StarRatingFilter value={5} onChange={vi.fn()} />);

    const filledStars = document.querySelectorAll('[data-testid="StarIcon"]');
    const borderStars = document.querySelectorAll('[data-testid="StarBorderIcon"]');

    expect(filledStars.length).toBe(5);
    expect(borderStars.length).toBe(0);
  });
});
