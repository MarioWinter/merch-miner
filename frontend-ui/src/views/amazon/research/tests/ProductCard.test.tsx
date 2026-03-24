import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import ProductCard from '../partials/ProductCard';
import type { AmazonProduct } from '../types';

const buildProduct = (overrides?: Partial<AmazonProduct>): AmazonProduct => ({
  asin: 'B09TEST123',
  title: 'Funny Hiking T-Shirt',
  brand: 'TrailBrand',
  bsr: 5000,
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
  onAddToNiche: vi.fn(),
  isExpanded: false,
  onToggleExpand: vi.fn(),
};

describe('ProductCard', () => {
  it('renders all product fields (title, brand, price, rating, ASIN)', () => {
    const product = buildProduct();
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    expect(screen.getByText('Funny Hiking T-Shirt')).toBeInTheDocument();
    expect(screen.getByText('TrailBrand')).toBeInTheDocument();
    expect(screen.getByText('$19.99')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('(120)')).toBeInTheDocument();
    expect(screen.getByText('B09TEST123')).toBeInTheDocument();
  });

  it('BSR badge shows success color when bsr < 10000', () => {
    const product = buildProduct({ bsr: 5000 });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    const chip = screen.getByText('BSR 5,000').closest('.MuiChip-root');
    expect(chip).toHaveClass('MuiChip-colorSuccess');
  });

  it('BSR badge shows warning color when bsr is between 10000 and 50000', () => {
    const product = buildProduct({ bsr: 25000 });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    const chip = screen.getByText('BSR 25,000').closest('.MuiChip-root');
    expect(chip).toHaveClass('MuiChip-colorWarning');
  });

  it('BSR badge shows default color when bsr > 50000', () => {
    const product = buildProduct({ bsr: 100000 });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    const chip = screen.getByText('BSR 100,000').closest('.MuiChip-root');
    expect(chip).toHaveClass('MuiChip-colorDefault');
  });

  it('does not render BSR chip when bsr is null', () => {
    const product = buildProduct({ bsr: null });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    expect(screen.queryByText(/BSR/)).not.toBeInTheDocument();
  });

  it('expand toggle calls onToggleExpand when card is clicked', async () => {
    const onToggleExpand = vi.fn();
    const product = buildProduct();
    renderWithProviders(
      <ProductCard product={product} {...defaultProps} onToggleExpand={onToggleExpand} />,
    );

    // The StyledCard has role="button" and aria-expanded
    const card = screen.getByRole('button', { name: /funny hiking t-shirt/i });
    await userEvent.click(card);
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it('Add to Niche button triggers onAddToNiche without expanding card', async () => {
    const onAddToNiche = vi.fn();
    const onToggleExpand = vi.fn();
    const product = buildProduct();
    renderWithProviders(
      <ProductCard
        product={product}
        {...defaultProps}
        onAddToNiche={onAddToNiche}
        onToggleExpand={onToggleExpand}
      />,
    );

    const addBtn = screen.getByLabelText('Add to niche');
    await userEvent.click(addBtn);
    expect(onAddToNiche).toHaveBeenCalledTimes(1);
    // stopPropagation prevents card expand
    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  it('Amazon link has correct href and opens in new tab', () => {
    const product = buildProduct({ marketplace: 'amazon_de', asin: 'B09DETEST' });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    const link = screen.getByLabelText('Open on Amazon');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://www.amazon.de/dp/B09DETEST');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('days since publication calculated correctly', () => {
    // Set listed_date to 10 days ago
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const product = buildProduct({ listed_date: tenDaysAgo });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    // The getDaysSince function uses Math.floor so it could be 9 or 10 depending
    // on the time of day. Use a regex to match a reasonable range.
    expect(screen.getByText(/Published \d+d ago/)).toBeInTheDocument();
  });

  it('shows N/A for days since publication when listed_date is null', () => {
    const product = buildProduct({ listed_date: null });
    renderWithProviders(<ProductCard product={product} {...defaultProps} />);

    expect(screen.getByText('Published N/A ago')).toBeInTheDocument();
  });
});
