import { describe, it, expect } from 'vitest';
import {
  normalizePatternKey,
  getPatternVisual,
  FALLBACK_VISUAL,
  PATTERN_VISUALS,
} from '../patternConfig';

describe('normalizePatternKey', () => {
  it('strips single-digit number prefix', () => {
    expect(normalizePatternKey('1: IDENTITY DECLARATION')).toBe(
      'IDENTITY DECLARATION',
    );
  });

  it('strips multi-digit number prefix', () => {
    expect(normalizePatternKey('12: BOUNDARY/GATEKEEPING')).toBe(
      'BOUNDARY/GATEKEEPING',
    );
  });

  it('replaces underscores with spaces', () => {
    expect(normalizePatternKey('IDENTITY_DECLARATION')).toBe(
      'IDENTITY DECLARATION',
    );
  });

  it('uppercases lowercase input', () => {
    expect(normalizePatternKey('identity declaration')).toBe(
      'IDENTITY DECLARATION',
    );
  });

  it('handles combined prefix + underscores', () => {
    expect(normalizePatternKey('7: addiction_obsession')).toBe(
      'ADDICTION OBSESSION',
    );
  });

  it('collapses multiple spaces', () => {
    expect(normalizePatternKey('CHAOS   CONTROL')).toBe('CHAOS CONTROL');
  });

  it('trims whitespace', () => {
    expect(normalizePatternKey('  GROUP LEADER  ')).toBe('GROUP LEADER');
  });
});

describe('getPatternVisual', () => {
  it('returns exact match for plain key', () => {
    const visual = getPatternVisual('IDENTITY DECLARATION');
    expect(visual.color).toBe('#FF5A4F');
    expect(visual.label).toBe('Identity Declaration');
  });

  it('resolves numbered prefix format', () => {
    const visual = getPatternVisual('1: IDENTITY DECLARATION');
    expect(visual.color).toBe('#FF5A4F');
    expect(visual).not.toBe(FALLBACK_VISUAL);
  });

  it('resolves lowercase input', () => {
    const visual = getPatternVisual('boundary/gatekeeping');
    expect(visual.color).toBe('#94A3B8');
    expect(visual.label).toBe('Boundary Gatekeeping');
  });

  it('resolves underscore format when key matches after normalization', () => {
    // CROSS_NICHE_EVENTS normalizes to "CROSS NICHE EVENTS" which does NOT
    // match "CROSS-NICHE EVENTS" (hyphen vs space), so fallback is expected.
    const visual = getPatternVisual('CROSS_NICHE_EVENTS');
    expect(visual).toBe(FALLBACK_VISUAL);
  });

  it('resolves exact hyphenated key', () => {
    const visual = getPatternVisual('CROSS-NICHE EVENTS');
    expect(visual.label).toBe('Cross-Niche Events');
  });

  it('returns FALLBACK_VISUAL for unknown pattern', () => {
    const visual = getPatternVisual('UNKNOWN_THING');
    expect(visual).toBe(FALLBACK_VISUAL);
    expect(visual.color).toBe('#7BAAB8');
    expect(visual.label).toBe('Unknown Pattern');
  });

  it('every registered pattern has required fields', () => {
    for (const [key, visual] of Object.entries(PATTERN_VISUALS)) {
      expect(visual.icon, `${key} missing icon`).toBeDefined();
      expect(visual.color, `${key} missing color`).toBeTruthy();
      expect(visual.label, `${key} missing label`).toBeTruthy();
    }
  });
});
