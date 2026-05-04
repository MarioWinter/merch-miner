import type { MbaProductCatalogEntry } from '../types';

/**
 * Compute the per-unit royalty for a (product, marketplace, price) tuple
 * against the MBA catalog's published formula `price * coef - base`.
 *
 * Returns `null` when any input is unresolvable — unknown product key,
 * marketplace not supported for that product, or non-finite price. Rounded
 * to 2 decimals. The raw value is returned — including negatives — so the
 * UI (P4 MarketplacePricing) can render red for a loss, green for a gain
 * (AC-43).
 */
export const royaltyFor = (
  catalog: ReadonlyArray<MbaProductCatalogEntry> | undefined,
  productKey: string,
  marketplace: string,
  price: number | null | undefined,
): number | null => {
  if (!catalog || catalog.length === 0) return null;
  if (!Number.isFinite(price ?? NaN)) return null;

  const entry = catalog.find((e) => e.key === productKey);
  if (!entry) return null;

  const formula = entry.royalty_formula[marketplace];
  if (!formula) return null;

  const raw = (price as number) * formula.coef - formula.base;
  return Math.round(raw * 100) / 100;
};
