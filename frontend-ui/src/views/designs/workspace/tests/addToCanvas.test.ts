import { describe, it, expect } from 'vitest';
import { fitToMaxDimension, MAX_ARTBOARD_DIM } from '../../board/utils/artboardSizing';

// -----------------------------------------------------------------
// Tests: "Add to Canvas" dimension logic
// -----------------------------------------------------------------

describe('Add to Canvas: artboard dimensions via fitToMaxDimension', () => {
  it('scales down large images to fit within MAX_ARTBOARD_DIM', () => {
    // Typical POD design: 4500x5400
    const result = fitToMaxDimension(4500, 5400);
    expect(result.width).toBeLessThanOrEqual(MAX_ARTBOARD_DIM);
    expect(result.height).toBeLessThanOrEqual(MAX_ARTBOARD_DIM);
    // Should preserve aspect ratio
    const inputRatio = 4500 / 5400;
    const outputRatio = result.width / result.height;
    expect(Math.abs(inputRatio - outputRatio)).toBeLessThan(0.02);
  });

  it('keeps small images unchanged', () => {
    const result = fitToMaxDimension(200, 300);
    expect(result.width).toBe(200);
    expect(result.height).toBe(300);
  });

  it('scales square images correctly', () => {
    const result = fitToMaxDimension(1200, 1200);
    expect(result.width).toBe(MAX_ARTBOARD_DIM);
    expect(result.height).toBe(MAX_ARTBOARD_DIM);
  });

  it('creates artboard with correct dimensions for editor image data', () => {
    // Simulate handleAddToCanvas logic from useWorkspaceActions
    const editorImage = { url: 'blob:test', name: 'design.png', width: 800, height: 600 };
    const { width, height } = fitToMaxDimension(
      editorImage.width ?? 280,
      editorImage.height ?? 280,
    );

    // 800x600 already within MAX_ARTBOARD_DIM (600), height fits, width exceeds
    // scale = min(600/800, 600/600) = min(0.75, 1) = 0.75
    expect(width).toBe(Math.round(800 * 0.75));
    expect(height).toBe(Math.round(600 * 0.75));
  });

  it('places artboard to the right of existing artboards', () => {
    // Simulate placement logic from handleAddToCanvas
    const existingArtboards = [
      { x: 0, width: 300 },
      { x: 340, width: 400 },
    ];

    let placeX = 0;
    if (existingArtboards.length > 0) {
      let maxRight = -Infinity;
      for (const ab of existingArtboards) {
        const right = ab.x + ab.width;
        if (right > maxRight) maxRight = right;
      }
      placeX = maxRight + 40;
    }

    // maxRight = max(300, 740) = 740 -> placeX = 780
    expect(placeX).toBe(780);
  });

  it('places first artboard at x=0 when no existing artboards', () => {
    const existingArtboards: Array<{ x: number; width: number }> = [];
    let placeX = 0;
    if (existingArtboards.length > 0) {
      let maxRight = -Infinity;
      for (const ab of existingArtboards) {
        const right = ab.x + ab.width;
        if (right > maxRight) maxRight = right;
      }
      placeX = maxRight + 40;
    }
    expect(placeX).toBe(0);
  });
});
