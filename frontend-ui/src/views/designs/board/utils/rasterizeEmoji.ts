/**
 * Rasterize an emoji character to a PNG data URL via offscreen canvas.
 *
 * @param emoji - The emoji character(s) to rasterize
 * @param size  - Canvas size in px (default 128 for quality; rendered emoji is ~80% of canvas)
 * @returns data:image/png base64 URI
 */
const rasterizeEmoji = (emoji: string, size = 128): string => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Use a large font so the emoji fills most of the canvas
  const fontSize = Math.round(size * 0.75);
  ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2);

  return canvas.toDataURL('image/png');
};

export default rasterizeEmoji;
