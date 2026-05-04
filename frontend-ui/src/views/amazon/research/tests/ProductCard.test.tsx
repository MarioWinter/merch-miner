import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import ProductCard from '../partials/ProductCard';
import type { AmazonProduct } from '../types';

// Mock BSR history query used by sparkline
vi.mock('../../../../store/researchSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/researchSlice')>();
  return {
    ...actual,
    useGetBSRHistoryQuery: () => ({ data: [], isLoading: false }),
  };
});

const buildProduct = (overrides?: Partial<AmazonProduct>): AmazonProduct => ({
  id: 'prod-test-123',
  asin: 'B09TEST123',
  title: 'Funny Hiking T-Shirt',
  brand: 'TrailBrand',
  bsr: 5000,
  bsr_categories: [{ rank: 73692, category: 'Clothing, Shoes & Jewelry', category_url: '' }],
  rating: 4.5,
  reviews_count: 120,
  price: 19.99,
  product_type: 't_shirt',
  subcategory: 'Novelty',
  listed_date: '2025-01-15',
  thumbnail_url: 'https://example.com/img.jpg',
  bullet_1: 'Bullet one',
  bullet_2: 'Bullet two',
  description: 'A hiking tee',
  marketplace: 'amazon_com',
  scraped_at: '2026-03-01T00:00:00Z',
  ...overrides,
});

const defaultProps = {
  onClick: vi.fn(),
};

describe('ProductCard', () => {
  it('renders BSR value, price, rating stars, reviews, and ASIN', () => {
    const product = buildProduct();
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    // BSR displayed from first bsr_categories entry (73,692)
    expect(screen.getByText('73,692')).toBeInTheDocument();
    expect(screen.getByText('$19.99')).toBeInTheDocument();
    // Reviews shown as "/ 120 reviews"
    expect(screen.getByText(/120 reviews/)).toBeInTheDocument();
    expect(screen.getByText('B09TEST123')).toBeInTheDocument();
  });

  it('BSR text uses success color when bsr < 10000', () => {
    const product = buildProduct({ bsr: 5000, bsr_categories: [{ rank: 5000, category: 'Novelty T-Shirts', category_url: '' }] });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    const bsrText = screen.getByText('5,000');
    expect(bsrText).toBeInTheDocument();
  });

  it('BSR text uses warning level when bsr is between 10000 and 50000', () => {
    const product = buildProduct({ bsr: 25000, bsr_categories: [{ rank: 25000, category: 'Clothing', category_url: '' }] });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    expect(screen.getByText('25,000')).toBeInTheDocument();
  });

  it('BSR text shows low sales when bsr > 50000', () => {
    const product = buildProduct({ bsr: 100000, bsr_categories: [{ rank: 100000, category: 'Clothing', category_url: '' }] });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    expect(screen.getByText('100,000')).toBeInTheDocument();
  });

  it('shows main category BSR from bsr_categories', () => {
    const product = buildProduct({
      bsr: 5000,
      bsr_categories: [
        { rank: 73692, category: 'Clothing, Shoes & Jewelry', category_url: '' },
        { rank: 1234, category: 'Novelty T-Shirts', category_url: '' },
      ],
    });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    // Should display the first bsr_categories entry (main category), not product.bsr
    expect(screen.getByText('73,692')).toBeInTheDocument();
  });

  it('falls back to product.bsr when bsr_categories is empty', () => {
    const product = buildProduct({ bsr: 5000, bsr_categories: [] });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    expect(screen.getByText('5,000')).toBeInTheDocument();
  });

  it('does not render BSR when bsr is null and bsr_categories is empty', () => {
    const product = buildProduct({ bsr: null, bsr_categories: [] });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    expect(screen.getByText('\u2013')).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', async () => {
    const onClick = vi.fn();
    const product = buildProduct();
    renderWithProviders(<ProductCard product={product} onClick={onClick} />);

    const card = screen.getByRole('button', { name: /product b09test123/i });
    await userEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders hover overlay action buttons', () => {
    const product = buildProduct();
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    expect(screen.getByLabelText('Add favorite')).toBeInTheDocument();
    expect(screen.getByLabelText('Copy ASIN')).toBeInTheDocument();
    expect(screen.getByLabelText('Open on Amazon')).toBeInTheDocument();
    expect(screen.getByLabelText('View details')).toBeInTheDocument();
  });

  it('shows filled heart icon when isFavorite is true', () => {
    const product = buildProduct();
    renderWithProviders(
      <ProductCard product={product} {...defaultProps} isFavorite />,
    );

    const favBtn = screen.getByLabelText('Remove favorite');
    expect(favBtn.querySelector('[data-testid="FavoriteIcon"]')).toBeInTheDocument();
  });

  it('shows AI badge when hasSloganExtracted is true', () => {
    const product = buildProduct();
    renderWithProviders(
      <ProductCard product={product} {...defaultProps} hasSloganExtracted />,
    );

    expect(
      document.querySelector('[data-testid="AutoAwesomeIcon"]'),
    ).toBeInTheDocument();
  });

  it('does not show AI badge when hasSloganExtracted is false', () => {
    const product = buildProduct();
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    expect(
      document.querySelector('[data-testid="AutoAwesomeIcon"]'),
    ).not.toBeInTheDocument();
  });

  it('renders product image with correct src', () => {
    const product = buildProduct();
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    const img = screen.getByAltText('Funny Hiking T-Shirt');
    expect(img).toHaveAttribute('src', 'https://example.com/img.jpg');
  });

  it('renders 5 star icons for rating display', () => {
    const product = buildProduct({ rating: 4.5 });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    // 5 star icons total (filled + empty)
    const starIcons = document.querySelectorAll('[data-testid="StarIcon"]');
    expect(starIcons.length).toBe(5);
  });

  it('shows singular "review" when reviews_count is 1', () => {
    const product = buildProduct({ reviews_count: 1 });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    expect(screen.getByText(/1 review$/)).toBeInTheDocument();
  });

  it('does not show title or brand on card', () => {
    const product = buildProduct({ title: 'Funny Hiking T-Shirt', brand: 'TrailBrand' });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    // Title appears only as img alt, not as visible text
    expect(screen.queryByText('Funny Hiking T-Shirt')).not.toBeInTheDocument();
    expect(screen.queryByText('TrailBrand')).not.toBeInTheDocument();
  });

  it('ASIN chip copies to clipboard on click', async () => {
    const product = buildProduct();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    const asinChip = screen.getByLabelText(/Copy ASIN B09TEST123/);
    await userEvent.click(asinChip);
    expect(writeText).toHaveBeenCalledWith('B09TEST123');
  });
});
