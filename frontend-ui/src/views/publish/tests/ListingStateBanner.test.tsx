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
  onGenerate: vi.fn(),
  onRetry: vi.fn(),
  isGenerating: false,
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

  it('renders generate button on notFound', async () => {
    const onGenerate = vi.fn();
    renderWithProviders(
      <ListingStateBanner {...defaultProps} notFound onGenerate={onGenerate} />,
    );
    expect(screen.getByText(/No listing for mba yet/i)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /generate listing/i });
    await userEvent.click(btn);
    expect(onGenerate).toHaveBeenCalled();
  });

  it('disables generate button while generating', () => {
    renderWithProviders(
      <ListingStateBanner {...defaultProps} notFound isGenerating />,
    );
    const btn = screen.getByRole('button', { name: /generating/i });
    expect(btn).toBeDisabled();
  });

  it('renders nothing when listing loaded successfully', () => {
    const { container } = renderWithProviders(
      <ListingStateBanner {...defaultProps} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
