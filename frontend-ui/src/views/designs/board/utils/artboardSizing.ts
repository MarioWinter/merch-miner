// -----------------------------------------------------------------
// Shared artboard sizing & naming helpers
// -----------------------------------------------------------------

/** Maximum artboard dimension in world-space pixels */
export const MAX_ARTBOARD_DIM = 600;

/** Default artboard size when no image dimensions are available */
export const DEFAULT_ARTBOARD_WIDTH = 280;
export const DEFAULT_ARTBOARD_HEIGHT = 280;

/**
 * Scale dimensions to fit within `maxDim` while preserving aspect ratio.
 * Returns original dimensions if already within bounds.
 */
export const fitToMaxDimension = (
  w: number,
  h: number,
  maxDim = MAX_ARTBOARD_DIM,
): { width: number; height: number } => {
  if (w <= maxDim && h <= maxDim) return { width: w, height: h };
  const scale = Math.min(maxDim / w, maxDim / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
};

/**
 * Find the next "Artboard N" label based on the highest existing number.
 * Scans all labels matching /^Artboard\s+(\d+)$/ and returns N+1.
 */
export const nextArtboardLabel = (existingLabels: string[]): string => {
  let maxNum = 0;
  for (const label of existingLabels) {
    const match = label.match(/^Artboard\s+(\d+)$/);
    if (match) maxNum = Math.max(maxNum, Number(match[1]));
  }
  return `Artboard ${maxNum + 1}`;
};
