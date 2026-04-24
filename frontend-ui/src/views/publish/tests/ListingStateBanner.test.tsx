import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import ListingStateBanner from '../partials/edit/ListingStateBanner';

const defaultProps = {
  isLoading: false,
  isFetching: false,
  notFound: false,
  hasError: false,
  onRetry: vi.fn(),
  marketplace: 'mba',
};

describe('ListingStateBanner', () => {
  it('renders loading skeletons when isLoading', () => {
    const { container } = renderWithProviders(
      <ListingStateBanner {...defaultProps} isLoading />,
    );
    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(
      0,
    );
  });

  it('renders retry button on hard error', async () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <ListingStateBanner {...defaultProps} hasError onRetry={onRetry} />,
    );
    const btn = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(btn);
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders a Convert-from-another-tab hint on notFound (no Generate CTA)', () => {
    renderWithProviders(<ListingStateBanner {...defaultProps} notFound />);
    expect(
      screen.getByText(/No listing for mba yet\. Convert from another marketplace/i),
    ).toBeInTheDocument();
    // The Generate CTA was retired with the Generate endpoint (P8).
    expect(
      screen.queryByRole('button', { name: /generate listing/i }),
    ).not.toBeInTheDocument();
  });

  it('renders nothing when listing loaded successfully', () => {
    const { container } = renderWithProviders(
      <ListingStateBanner {...defaultProps} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
