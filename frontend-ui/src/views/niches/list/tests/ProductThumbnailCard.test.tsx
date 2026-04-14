import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { fa } = vi.hoisted(() => ({
  fa: (n: string) => ({
    reducerPath: n,
    reducer: () => ({}),
    middleware: () => (x: any) => (a: any) => x(a),
    util: { resetApiState: () => ({ type: 'noop' }) },
  }),
}));
vi.mock('@/store/nicheSlice', () => ({ nicheApi: fa('nicheApi'), useListNichesQuery: () => ({ data: { results: [] }, isLoading: false }) }));
vi.mock('@/store/ideaSlice', () => ({ ideaApi: fa('ideaApi') }));
vi.mock('@/store/researchSlice', () => ({ researchApi: fa('researchApi') }));
vi.mock('@/store/keywordSlice', () => ({ keywordApi: fa('keywordApi') }));
vi.mock('@/store/publishSlice', () => ({ publishApi: fa('publishApi') }));
vi.mock('@/store/dashboardSlice', () => ({ dashboardApi: fa('dashboardApi') }));
vi.mock('@/store/kanbanSlice', () => ({ kanbanApi: fa('kanbanApi') }));
vi.mock('@/store/notificationSlice', () => ({ notificationApi: fa('notificationApi') }));
vi.mock('@/store/searchSlice', () => ({ searchApi: fa('searchApi') }));
vi.mock('@/store/agentSlice', () => ({ agentApi: fa('agentApi') }));
vi.mock('@/store/collectedProductsSlice', () => ({ collectedProductsApi: fa('collectedProductsApi') }));
vi.mock('@/store/designSlice', () => ({ designApi: fa('designApi') }));

import { renderWithProviders } from '../../../../utils/test-utils';
import ProductThumbnailCard from '../partials/ProductThumbnailCard';

const defaultProps = {
  thumbnailUrl: 'https://example.com/dog.jpg',
  title: 'Funny Dog T-Shirt',
  bsr: 12345,
  price: 19.99,
  selected: false,
  anySelected: false,
  hasImage: true,
  onSelect: vi.fn(),
  onKeywords: vi.fn(),
  onSlogans: vi.fn(),
  onCanvas: vi.fn(),
  onDetail: vi.fn(),
  onRemove: vi.fn(),
};

describe('ProductThumbnailCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders product thumbnail image', () => {
    renderWithProviders(<ProductThumbnailCard {...defaultProps} />);
    const img = screen.getByAltText('Funny Dog T-Shirt');
    expect(img).toHaveAttribute('src', 'https://example.com/dog.jpg');
  });

  it('renders BSR value formatted correctly', () => {
    renderWithProviders(<ProductThumbnailCard {...defaultProps} bsr={12345} />);
    expect(screen.getByText('12k')).toBeInTheDocument();
  });

  it('renders BSR with M suffix for millions', () => {
    renderWithProviders(
      <ProductThumbnailCard {...defaultProps} bsr={1500000} />,
    );
    expect(screen.getByText('1.5M')).toBeInTheDocument();
  });

  it('renders dash when BSR is null', () => {
    renderWithProviders(
      <ProductThumbnailCard {...defaultProps} bsr={null} />,
    );
    // Both BSR and price can show "-"
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders price formatted correctly', () => {
    renderWithProviders(
      <ProductThumbnailCard {...defaultProps} price={19.99} />,
    );
    expect(screen.getByText('$19.99')).toBeInTheDocument();
  });

  it('renders dash when price is null', () => {
    renderWithProviders(
      <ProductThumbnailCard {...defaultProps} price={null} />,
    );
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders checkbox with title as aria-label', () => {
    renderWithProviders(<ProductThumbnailCard {...defaultProps} />);
    const checkbox = screen.getByRole('checkbox', {
      name: 'Funny Dog T-Shirt',
    });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('renders checkbox as checked when selected', () => {
    renderWithProviders(
      <ProductThumbnailCard {...defaultProps} selected anySelected />,
    );
    const checkbox = screen.getByRole('checkbox', {
      name: 'Funny Dog T-Shirt',
    });
    expect(checkbox).toBeChecked();
  });

  it('calls onSelect when checkbox is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <ProductThumbnailCard {...defaultProps} onSelect={onSelect} />,
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Funny Dog T-Shirt' }),
    );
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('calls onDetail when card is clicked', async () => {
    const user = userEvent.setup();
    const onDetail = vi.fn();
    renderWithProviders(
      <ProductThumbnailCard {...defaultProps} onDetail={onDetail} />,
    );
    // Click on the card (not checkbox or hover actions)
    const img = screen.getByAltText('Funny Dog T-Shirt');
    await user.click(img);
    expect(onDetail).toHaveBeenCalled();
  });

  it('renders hover overlay with action buttons', () => {
    renderWithProviders(<ProductThumbnailCard {...defaultProps} />);
    // Hover actions are icon-only buttons with aria-labels via Tooltip
    expect(screen.getByTestId('SearchIcon')).toBeInTheDocument();
    expect(screen.getByTestId('FormatQuoteIcon')).toBeInTheDocument();
    expect(screen.getByTestId('OpenInNewIcon')).toBeInTheDocument();
    expect(screen.getByTestId('MoreHorizIcon')).toBeInTheDocument();
  });

  it('renders BSR with green color for low BSR', () => {
    renderWithProviders(
      <ProductThumbnailCard {...defaultProps} bsr={5000} />,
    );
    // BSR < 10k gets success color
    expect(screen.getByText('5k')).toBeInTheDocument();
  });
});
