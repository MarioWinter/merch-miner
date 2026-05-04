import { describe, it, expect, vi, beforeEach } from 'vitest';
import UPNG from 'upng-js';
import { compressImage } from '../hooks/useExportCompression';

// -----------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------

vi.mock('upng-js', () => ({
  default: {
    encode: vi.fn(() => new ArrayBuffer(64)),
  },
}));

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/** Create a simple RGBA buffer (4 bytes per pixel). */
const makeRgbaBuffer = (width: number, height: number): ArrayBuffer => {
  const buf = new ArrayBuffer(width * height * 4);
  const view = new Uint8Array(buf);
  // Fill with non-trivial pixel data so compression has something to work with
  for (let i = 0; i < view.length; i++) {
    view[i] = i % 256;
  }
  return buf;
};

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe('compressImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a Blob', () => {
    const rgba = makeRgbaBuffer(10, 10);
    const result = compressImage(rgba, 10, 10, 'medium');
    expect(result).toBeInstanceOf(Blob);
  });

  it('returns a PNG Blob with correct MIME type', () => {
    const rgba = makeRgbaBuffer(10, 10);
    const result = compressImage(rgba, 10, 10, 'medium');
    expect(result.type).toBe('image/png');
  });

  it('calls UPNG.encode with colorCount=0 for level "off"', () => {
    const rgba = makeRgbaBuffer(4, 4);
    compressImage(rgba, 4, 4, 'off');
    expect(UPNG.encode).toHaveBeenCalledWith([rgba], 4, 4, 0);
  });

  it('calls UPNG.encode with colorCount=128 for level "very_high"', () => {
    const rgba = makeRgbaBuffer(4, 4);
    compressImage(rgba, 4, 4, 'very_high');
    expect(UPNG.encode).toHaveBeenCalledWith([rgba], 4, 4, 128);
  });

  it('calls UPNG.encode with colorCount=1024 for level "medium"', () => {
    const rgba = makeRgbaBuffer(4, 4);
    compressImage(rgba, 4, 4, 'medium');
    expect(UPNG.encode).toHaveBeenCalledWith([rgba], 4, 4, 1024);
  });

  it('calls UPNG.encode with colorCount=256 for level "high"', () => {
    const rgba = makeRgbaBuffer(4, 4);
    compressImage(rgba, 4, 4, 'high');
    expect(UPNG.encode).toHaveBeenCalledWith([rgba], 4, 4, 256);
  });

  it('calls UPNG.encode with colorCount=4096 for level "low"', () => {
    const rgba = makeRgbaBuffer(4, 4);
    compressImage(rgba, 4, 4, 'low');
    expect(UPNG.encode).toHaveBeenCalledWith([rgba], 4, 4, 4096);
  });

  it('produces a valid Blob for "off" compression', () => {
    const rgba = makeRgbaBuffer(8, 8);
    const blob = compressImage(rgba, 8, 8, 'off');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('image/png');
  });

  it('produces a smaller Blob for "very_high" vs "off" when UPNG returns different sizes', () => {
    // Override mock to return size-appropriate buffers
    const encodeMock = vi.mocked(UPNG.encode);
    encodeMock
      .mockReturnValueOnce(new ArrayBuffer(5000)) // off (no quantization)
      .mockReturnValueOnce(new ArrayBuffer(1000)); // very_high (aggressive quantization)

    const rgba = makeRgbaBuffer(50, 50);
    const blobOff = compressImage(rgba, 50, 50, 'off');
    const blobVeryHigh = compressImage(rgba, 50, 50, 'very_high');

    expect(blobVeryHigh.size).toBeLessThan(blobOff.size);
  });
});
