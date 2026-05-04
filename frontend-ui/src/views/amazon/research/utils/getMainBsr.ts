import type { BSRCategory } from '../types';

/**
 * Returns the broadest-category BSR rank for a product.
 *
 * Logic: Amazon lists multiple category ranks per product (e.g. "Clothing,
 * Shoes & Jewelry" rank 73,692 and "Novelty T-Shirts" rank 1,234). The
 * broadest category has the highest rank — that's the one shown on the card
 * and the detail KPI row. Falls back to product.bsr when bsr_categories is
 * empty.
 */
export const getMainBsr = (product: {
  bsr: number | null;
  bsr_categories: BSRCategory[];
}): number | null => {
  if (!product.bsr_categories?.length) return product.bsr;
  const broadest = product.bsr_categories.reduce((a, b) =>
    a.rank > b.rank ? a : b,
  );
  return broadest.rank;
};
