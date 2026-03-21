import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import { PatternCard } from '../partials/PatternCard';
import type { PatternItem } from '../types';

const activePattern: PatternItem = {
  name: 'IDENTITY_DECLARATION',
  present: true,
  context: 'Slogans like "I Hike Because..." show strong identity pride.',
};

const inactivePattern: PatternItem = {
  name: 'VINTAGE_LEGACY',
  present: false,
  context: '',
};

const inactiveWithContext: PatternItem = {
  name: 'CHAOS_CONTROL',
  present: false,
  context: 'Minor traces detected but not dominant.',
};

describe('PatternCard', () => {
  it('renders active pattern with label and context', () => {
    renderWithProviders(<PatternCard pattern={activePattern} />);

    expect(screen.getByText('Identity Declaration')).toBeInTheDocument();
    expect(screen.getByText(activePattern.context)).toBeInTheDocument();
  });

  it('renders inactive pattern label in collapsed state', () => {
    renderWithProviders(<PatternCard pattern={inactivePattern} />);

    expect(screen.getByText('Vintage / Legacy')).toBeInTheDocument();
    // Default fallback text should not be visible until expanded
    expect(screen.queryByText('Not detected in this niche.')).not.toBeVisible();
  });

  it('expands inactive card on click to show context', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PatternCard pattern={inactiveWithContext} />);

    expect(screen.getByText('Chaos / Control')).toBeInTheDocument();

    // Click the card to expand
    await user.click(screen.getByText('Chaos / Control'));

    expect(screen.getByText('Minor traces detected but not dominant.')).toBeVisible();
  });

  it('shows fallback text for inactive pattern with no context', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PatternCard pattern={inactivePattern} />);

    await user.click(screen.getByText('Vintage / Legacy'));

    expect(screen.getByText('Not detected in this niche.')).toBeVisible();
  });

  it('has accessible expand/collapse button for inactive pattern', () => {
    renderWithProviders(<PatternCard pattern={inactivePattern} />);

    expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();
  });
});
