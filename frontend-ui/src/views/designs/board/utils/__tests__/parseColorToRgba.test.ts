import { describe, it, expect } from 'vitest';
import { parseColorToRgba, RGBA_FALLBACK } from '../parseColorToRgba';

describe('parseColorToRgba', () => {
  it('converts #RRGGBB to rgba(R, G, B, 1)', () => {
    expect(parseColorToRgba('#FF5A4F')).toBe('rgba(255, 90, 79, 1)');
    expect(parseColorToRgba('#000000')).toBe('rgba(0, 0, 0, 1)');
    expect(parseColorToRgba('#FFFFFF')).toBe('rgba(255, 255, 255, 1)');
  });

  it('converts #RRGGBBAA to rgba(R, G, B, A/255) with 3-decimal alpha', () => {
    // 0x80 = 128 → 128/255 ≈ 0.502
    expect(parseColorToRgba('#FF5A4F80')).toBe('rgba(255, 90, 79, 0.502)');
    // 0x00 → 0 alpha
    expect(parseColorToRgba('#11223300')).toBe('rgba(17, 34, 51, 0)');
    // 0xFF → 1 alpha
    expect(parseColorToRgba('#112233FF')).toBe('rgba(17, 34, 51, 1)');
  });

  it('passes through valid rgba() strings (normalized formatting)', () => {
    expect(parseColorToRgba('rgba(255, 90, 79, 0.5)')).toBe(
      'rgba(255, 90, 79, 0.5)',
    );
    expect(parseColorToRgba('rgba(0, 0, 0, 0)')).toBe('rgba(0, 0, 0, 0)');
    expect(parseColorToRgba('rgba(255,255,255,1)')).toBe(
      'rgba(255, 255, 255, 1)',
    );
  });

  it('falls back to rgba(255, 255, 255, 1) on invalid input', () => {
    expect(parseColorToRgba('not-a-color')).toBe(RGBA_FALLBACK);
    expect(parseColorToRgba('')).toBe(RGBA_FALLBACK);
    expect(parseColorToRgba('#XYZ')).toBe(RGBA_FALLBACK);
    expect(parseColorToRgba('#FFF')).toBe(RGBA_FALLBACK); // 3-char hex not supported
    expect(parseColorToRgba('rgba(300, 0, 0)')).toBe(RGBA_FALLBACK); // missing alpha
  });

  it('accepts both lowercase and uppercase hex', () => {
    expect(parseColorToRgba('#ff5a4f')).toBe('rgba(255, 90, 79, 1)');
    expect(parseColorToRgba('#FF5A4F')).toBe('rgba(255, 90, 79, 1)');
    expect(parseColorToRgba('#aAbBcC80')).toBe('rgba(170, 187, 204, 0.502)');
  });

  it('tolerates whitespace around the input', () => {
    expect(parseColorToRgba('   #FF5A4F   ')).toBe('rgba(255, 90, 79, 1)');
    expect(parseColorToRgba('  rgba(10, 20, 30, 0.25)  ')).toBe(
      'rgba(10, 20, 30, 0.25)',
    );
  });
});
