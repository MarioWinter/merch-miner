import { describe, it, expect } from 'vitest';
import { getMainBsr } from '../getMainBsr';

describe('getMainBsr', () => {
  it('falls back to product.bsr when bsr_categories is empty', () => {
    expect(getMainBsr({ bsr: 5000, bsr_categories: [] })).toBe(5000);
  });

  it('falls back to product.bsr (null) when bsr_categories is empty and bsr null', () => {
    expect(getMainBsr({ bsr: null, bsr_categories: [] })).toBeNull();
  });

  it('picks the entry with the highest rank (broadest category)', () => {
    const result = getMainBsr({
      bsr: 5000,
      bsr_categories: [
        { rank: 1234, category: 'Novelty T-Shirts', category_url: '' },
        { rank: 73692, category: 'Clothing, Shoes & Jewelry', category_url: '' },
      ],
    });
    expect(result).toBe(73692);
  });

  it('returns the only category rank when one entry exists', () => {
    const result = getMainBsr({
      bsr: 5000,
      bsr_categories: [
        { rank: 18998, category: 'Clothing, Shoes & Jewelry', category_url: '' },
      ],
    });
    expect(result).toBe(18998);
  });
});
