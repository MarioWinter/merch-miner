// -----------------------------------------------------------------
// parseColorToRgba
//
// Normalizes any persisted artboard background-color string to a
// canonical `rgba(R, G, B, A)` form. Accepted inputs:
//
//   - `rgba(R, G, B, A)` — pass-through (re-emitted with normalized
//     numeric formatting so downstream string comparisons remain
//     stable)
//   - `#RRGGBB`           → `rgba(R, G, B, 1)`
//   - `#RRGGBBAA`         → `rgba(R, G, B, A/255)` (3-decimal alpha)
//   - anything else       → `rgba(255, 255, 255, 1)` (white opaque)
//
// Used by `<ArtboardColorPicker />` to initialize its internal state
// regardless of how the value was persisted historically.
// -----------------------------------------------------------------

const FALLBACK = 'rgba(255, 255, 255, 1)';

const HEX6_REGEX = /^#([0-9a-fA-F]{6})$/;
const HEX8_REGEX = /^#([0-9a-fA-F]{8})$/;
const RGBA_REGEX =
  /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+|1\.0+)\s*\)$/;

const clampByte = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));

const roundAlpha = (a: number): number => {
  const clamped = Math.max(0, Math.min(1, a));
  // 3 decimal places, but strip trailing zeros so integer-1 stays `1`.
  return Number(clamped.toFixed(3));
};

export const parseColorToRgba = (value: string): string => {
  if (typeof value !== 'string') return FALLBACK;
  const trimmed = value.trim();
  if (!trimmed) return FALLBACK;

  const rgbaMatch = trimmed.match(RGBA_REGEX);
  if (rgbaMatch) {
    const r = clampByte(Number(rgbaMatch[1]));
    const g = clampByte(Number(rgbaMatch[2]));
    const b = clampByte(Number(rgbaMatch[3]));
    const a = roundAlpha(Number(rgbaMatch[4]));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  const hex8Match = trimmed.match(HEX8_REGEX);
  if (hex8Match) {
    const hex = hex8Match[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = roundAlpha(parseInt(hex.slice(6, 8), 16) / 255);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  const hex6Match = trimmed.match(HEX6_REGEX);
  if (hex6Match) {
    const hex = hex6Match[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 1)`;
  }

  return FALLBACK;
};

export const RGBA_FALLBACK = FALLBACK;
