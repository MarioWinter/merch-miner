// -----------------------------------------------------------------
// Client-side Image Processing — Resize & Reposition
// Canvas-based utility for batch image resizing/repositioning.
// -----------------------------------------------------------------

export interface ResizeParams {
  targetWidth: number; // default 4500
  targetHeight: number; // default 5400
  alignY: 'top' | 'center' | 'bottom'; // default 'top' (POD standard)
  alignX: 'left' | 'center' | 'right'; // default 'center'
  paddingPx: number; // padding around design, default 0
  bgColor: string; // fill color for empty space, default 'transparent'
  maintainAspectRatio: boolean; // default true
}

export const DEFAULT_RESIZE_PARAMS: ResizeParams = {
  targetWidth: 4500,
  targetHeight: 5400,
  alignY: 'top',
  alignX: 'center',
  paddingPx: 0,
  bgColor: 'transparent',
  maintainAspectRatio: true,
};

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/**
 * Load an image from a URL string or Blob.
 * Resolves with a fully decoded HTMLImageElement.
 */
export const loadImage = (source: string | Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));

    if (source instanceof Blob) {
      const url = URL.createObjectURL(source);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image from Blob'));
      };
      img.src = url;
    } else {
      img.src = source;
    }
  });

/**
 * Compute the scaled dimensions of the source image so it fits
 * within the available area (target minus padding) while preserving
 * the original aspect ratio.
 */
const computeScaledSize = (
  srcW: number,
  srcH: number,
  availW: number,
  availH: number,
  maintain: boolean,
): { width: number; height: number } => {
  if (!maintain) {
    return { width: availW, height: availH };
  }

  const ratio = Math.min(availW / srcW, availH / srcH);
  return {
    width: Math.round(srcW * ratio),
    height: Math.round(srcH * ratio),
  };
};

/**
 * Compute the draw position (top-left corner) on the target canvas
 * given alignment settings and available area.
 */
const computeDrawPosition = (
  scaledW: number,
  scaledH: number,
  availW: number,
  availH: number,
  paddingPx: number,
  alignX: ResizeParams['alignX'],
  alignY: ResizeParams['alignY'],
): { x: number; y: number } => {
  let x: number;
  let y: number;

  switch (alignX) {
    case 'left':
      x = paddingPx;
      break;
    case 'right':
      x = paddingPx + availW - scaledW;
      break;
    case 'center':
    default:
      x = paddingPx + Math.round((availW - scaledW) / 2);
      break;
  }

  switch (alignY) {
    case 'top':
      y = paddingPx;
      break;
    case 'bottom':
      y = paddingPx + availH - scaledH;
      break;
    case 'center':
    default:
      y = paddingPx + Math.round((availH - scaledH) / 2);
      break;
  }

  return { x, y };
};

// -----------------------------------------------------------------
// Core Processing
// -----------------------------------------------------------------

/**
 * Resize and reposition an image onto a new canvas of the target
 * dimensions. Returns the result as a PNG Blob.
 *
 * 1. Load source image
 * 2. Create target canvas (targetWidth x targetHeight)
 * 3. Scale design to fit within (target - 2*padding), preserving AR
 * 4. Position based on alignX / alignY
 * 5. Fill background with bgColor (or leave transparent)
 * 6. Export as PNG Blob
 */
export const processResize = async (
  imageSource: string | Blob,
  params: ResizeParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);

  const { targetWidth, targetHeight, paddingPx, bgColor, maintainAspectRatio, alignX, alignY } =
    params;

  // Available drawing area after padding
  const availW = Math.max(targetWidth - 2 * paddingPx, 1);
  const availH = Math.max(targetHeight - 2 * paddingPx, 1);

  // Use OffscreenCanvas when available (Web Worker friendly), else fallback
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(targetWidth, targetHeight)
      : createFallbackCanvas(targetWidth, targetHeight);

  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;

  if (!ctx) {
    throw new Error('Could not obtain 2D rendering context');
  }

  // Fill background
  if (bgColor !== 'transparent') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }
  // transparent: canvas is already clear (alpha = 0)

  // Compute scaled size
  const { width: scaledW, height: scaledH } = computeScaledSize(
    img.naturalWidth,
    img.naturalHeight,
    availW,
    availH,
    maintainAspectRatio,
  );

  // Compute position
  const { x, y } = computeDrawPosition(scaledW, scaledH, availW, availH, paddingPx, alignX, alignY);

  // Draw image
  ctx.drawImage(img, x, y, scaledW, scaledH);

  // Export as PNG Blob
  return canvasToBlob(canvas);
};

// -----------------------------------------------------------------
// Rotate & Flip
// -----------------------------------------------------------------

export interface RotateFlipParams {
  rotation: 0 | 90 | 180 | 270; // clockwise degrees, default 0
  flipH: boolean; // horizontal flip, default false
  flipV: boolean; // vertical flip, default false
}

export const DEFAULT_ROTATE_FLIP_PARAMS: RotateFlipParams = {
  rotation: 0,
  flipH: false,
  flipV: false,
};

/**
 * Rotate and/or flip an image. Returns the result as a PNG Blob.
 *
 * 1. Load source image
 * 2. For 90° / 270° rotation: swap canvas width & height
 * 3. Translate to center, apply rotation via context.rotate()
 * 4. Apply flip via scale(-1, 1) / scale(1, -1)
 * 5. Draw image centered
 * 6. Export as PNG Blob
 */
export const processRotateFlip = async (
  imageSource: string | Blob,
  params: RotateFlipParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);

  const { rotation, flipH, flipV } = params;
  const swapDimensions = rotation === 90 || rotation === 270;

  const canvasW = swapDimensions ? img.naturalHeight : img.naturalWidth;
  const canvasH = swapDimensions ? img.naturalWidth : img.naturalHeight;

  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(canvasW, canvasH)
      : createFallbackCanvas(canvasW, canvasH);

  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;

  if (!ctx) {
    throw new Error('Could not obtain 2D rendering context');
  }

  // Move origin to canvas center
  ctx.translate(canvasW / 2, canvasH / 2);

  // Apply rotation (convert degrees to radians)
  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180);
  }

  // Apply flips
  const scaleX = flipH ? -1 : 1;
  const scaleY = flipV ? -1 : 1;
  if (flipH || flipV) {
    ctx.scale(scaleX, scaleY);
  }

  // Draw image centered at origin (before transforms, image dims are original)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  // Export as PNG Blob
  return canvasToBlob(canvas);
};

// -----------------------------------------------------------------
// Trim (Auto-Crop)
// -----------------------------------------------------------------

export interface TrimParams {
  threshold: number; // alpha threshold 0–255, pixels below this are "transparent", default 10
  padding: number; // extra padding around trimmed result in px, default 0
  trimColor: 'transparent' | 'auto'; // 'transparent' = trim by alpha, 'auto' = detect dominant edge color and trim it
}

export const DEFAULT_TRIM_PARAMS: TrimParams = {
  threshold: 10,
  padding: 0,
  trimColor: 'transparent',
};

/**
 * Sample the four corner pixels and return the most common color as [r, g, b, a].
 */
const detectDominantEdgeColor = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
): [number, number, number, number] => {
  const pixelAt = (x: number, y: number): [number, number, number, number] => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };

  const corners = [
    pixelAt(0, 0),
    pixelAt(width - 1, 0),
    pixelAt(0, height - 1),
    pixelAt(width - 1, height - 1),
  ];

  // Return the most frequent corner color (simple majority vote)
  const counts = new Map<string, { count: number; color: [number, number, number, number] }>();
  for (const c of corners) {
    const key = c.join(',');
    const existing = counts.get(key);
    if (existing) existing.count++;
    else counts.set(key, { count: 1, color: c });
  }

  let best = corners[0];
  let bestCount = 0;
  for (const { count, color } of counts.values()) {
    if (count > bestCount) {
      bestCount = count;
      best = color;
    }
  }
  return best;
};

/**
 * Check if a pixel matches a reference color within a tolerance (Euclidean distance in RGB).
 */
const pixelMatchesColor = (
  data: Uint8ClampedArray,
  idx: number,
  ref: [number, number, number, number],
  tolerance: number,
): boolean => {
  const dr = data[idx] - ref[0];
  const dg = data[idx + 1] - ref[1];
  const db = data[idx + 2] - ref[2];
  const dist = Math.sqrt(dr * dr + dg * dg + db * db);
  return dist <= tolerance;
};

/**
 * Trim (auto-crop) an image by removing transparent or uniform-color edges.
 * Returns the trimmed result as a PNG Blob.
 *
 * 1. Load source, draw onto HTMLCanvasElement at original size
 * 2. Get ImageData for pixel scanning
 * 3. Find bounding box of non-trimmable content
 * 4. Create output canvas sized to bounding box + 2*padding
 * 5. Draw cropped region, export as PNG Blob
 */
export const processTrim = async (
  imageSource: string | Blob,
  params: TrimParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);
  const { threshold, padding, trimColor } = params;

  const w = img.naturalWidth;
  const h = img.naturalHeight;

  // Use HTMLCanvasElement for getImageData (not all browsers support it on OffscreenCanvas)
  const scanCanvas = createFallbackCanvas(w, h);
  const scanCtx = scanCanvas.getContext('2d');
  if (!scanCtx) throw new Error('Could not obtain 2D rendering context');

  scanCtx.drawImage(img, 0, 0);
  const imageData = scanCtx.getImageData(0, 0, w, h);
  const { data } = imageData;

  // Determine if a pixel should be trimmed
  let shouldTrim: (idx: number) => boolean;

  if (trimColor === 'auto') {
    const refColor = detectDominantEdgeColor(data, w, h);
    shouldTrim = (idx: number) => pixelMatchesColor(data, idx, refColor, threshold);
  } else {
    // Transparent mode: trim pixels with alpha <= threshold
    shouldTrim = (idx: number) => data[idx + 3] <= threshold;
  }

  // Find bounding box — scan from each edge inward
  let top = 0;
  let bottom = h - 1;
  let left = 0;
  let right = w - 1;

  // Top edge
  topScan: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!shouldTrim((y * w + x) * 4)) { top = y; break topScan; }
    }
  }

  // Bottom edge
  bottomScan: for (let y = h - 1; y >= top; y--) {
    for (let x = 0; x < w; x++) {
      if (!shouldTrim((y * w + x) * 4)) { bottom = y; break bottomScan; }
    }
  }

  // Left edge
  leftScan: for (let x = 0; x < w; x++) {
    for (let y = top; y <= bottom; y++) {
      if (!shouldTrim((y * w + x) * 4)) { left = x; break leftScan; }
    }
  }

  // Right edge
  rightScan: for (let x = w - 1; x >= left; x--) {
    for (let y = top; y <= bottom; y++) {
      if (!shouldTrim((y * w + x) * 4)) { right = x; break rightScan; }
    }
  }

  // Edge case: entire image is trimmable — return original unchanged
  const cropW = right - left + 1;
  const cropH = bottom - top + 1;
  if (cropW <= 0 || cropH <= 0) {
    return canvasToBlob(scanCanvas);
  }

  // Create output canvas with padding
  const outW = cropW + 2 * padding;
  const outH = cropH + 2 * padding;

  const outCanvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(outW, outH)
      : createFallbackCanvas(outW, outH);

  const outCtx = outCanvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;

  if (!outCtx) throw new Error('Could not obtain 2D rendering context');

  // Draw cropped region offset by padding
  outCtx.drawImage(
    scanCanvas,
    left, top, cropW, cropH,
    padding, padding, cropW, cropH,
  );

  return canvasToBlob(outCanvas);
};

// -----------------------------------------------------------------
// Color Adjustment (Filters)
// -----------------------------------------------------------------

export interface ColorAdjustmentParams {
  brightness: number; // -100 to 100, default 0 (0 = no change)
  contrast: number; // -100 to 100, default 0
  saturation: number; // -100 to 100, default 0
  hueShift: number; // 0 to 360 degrees, default 0
}

export const DEFAULT_COLOR_ADJUSTMENT_PARAMS: ColorAdjustmentParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hueShift: 0,
};

/** Clamp a value between min and max. */
const clamp = (val: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, val));

/**
 * Convert RGB (0–255) to HSL.
 * Returns [h (0–360), s (0–1), l (0–1)].
 */
const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  return [h * 360, s, l];
};

/** Helper for hslToRgb — converts a hue sector to an RGB channel value. */
const hueToChannel = (p: number, q: number, t: number): number => {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
};

/**
 * Convert HSL to RGB (0–255).
 * Input: h (0–360), s (0–1), l (0–1).
 */
const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const hn = h / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [
    Math.round(hueToChannel(p, q, hn + 1 / 3) * 255),
    Math.round(hueToChannel(p, q, hn) * 255),
    Math.round(hueToChannel(p, q, hn - 1 / 3) * 255),
  ];
};

/**
 * Apply brightness, contrast, saturation, and hue shift to an image.
 * Processes every pixel via ImageData. Returns the result as a PNG Blob.
 */
export const processColorAdjustment = async (
  imageSource: string | Blob,
  params: ColorAdjustmentParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = createFallbackCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not obtain 2D rendering context');

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;

  const { brightness, contrast, saturation, hueShift } = params;

  // Pre-compute brightness offset (-255..255)
  const brightnessOffset = brightness * 2.55;

  // Pre-compute contrast factor
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  // Pre-compute saturation multiplier
  const satMultiplier = (100 + saturation) / 100;

  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    // Skip fully transparent pixels
    if (data[i + 3] === 0) continue;

    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Brightness
    if (brightness !== 0) {
      r = clamp(r + brightnessOffset, 0, 255);
      g = clamp(g + brightnessOffset, 0, 255);
      b = clamp(b + brightnessOffset, 0, 255);
    }

    // Contrast
    if (contrast !== 0) {
      r = clamp(contrastFactor * (r - 128) + 128, 0, 255);
      g = clamp(contrastFactor * (g - 128) + 128, 0, 255);
      b = clamp(contrastFactor * (b - 128) + 128, 0, 255);
    }

    // Saturation & Hue Shift (both need HSL conversion)
    if (saturation !== 0 || hueShift !== 0) {
      const [hVal, sVal, lVal] = rgbToHsl(r, g, b);
      const newH = hueShift !== 0 ? (hVal + hueShift) % 360 : hVal;
      const newS = saturation !== 0 ? clamp(sVal * satMultiplier, 0, 1) : sVal;
      [r, g, b] = hslToRgb(newH, newS, lVal);
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
};

// -----------------------------------------------------------------
// Color Removal
// -----------------------------------------------------------------

export interface ColorTarget {
  targetColor: string; // hex color to remove, e.g. '#FFFFFF'
  tolerance: number; // 0–100 (Delta-E in CIE LAB space)
  softEdge: boolean; // gradual transparency near color boundary
}

export const DEFAULT_COLOR_TARGET: ColorTarget = {
  targetColor: '#FFFFFF',
  tolerance: 15,
  softEdge: true,
};

export interface ColorRemovalParams {
  mode: 'auto' | 'manual'; // auto = detect bg color from edges, manual = use targetColor
  targetColor: string; // hex color to remove (legacy single-color, used when colors is empty)
  tolerance: number; // 0–100 (legacy single-color)
  softEdge: boolean; // legacy single-color
  contiguous: boolean; // if true, flood-fill from edges — only remove connected regions
  fillHoles: boolean; // if true, fill interior holes left by non-contiguous removal
  edgeTrim: number; // 0–5px, shrink removal mask by N pixels (erode), default 0
  edgeFeather: number; // 0–5px, feather/blur mask edge for smooth transitions, default 0
  colors: ColorTarget[]; // multi-color removal (max 3), processed sequentially
  hdMode: 'auto' | 'on' | 'off'; // auto = upscale 2× if <3000px before processing
}

export const DEFAULT_COLOR_REMOVAL_PARAMS: ColorRemovalParams = {
  mode: 'auto',
  targetColor: '#FFFFFF',
  tolerance: 15,
  softEdge: true,
  contiguous: true,
  fillHoles: false,
  edgeTrim: 0,
  edgeFeather: 0,
  colors: [{ ...DEFAULT_COLOR_TARGET }],
  hdMode: 'auto',
};

/**
 * Parse a hex color string (e.g. '#FF5A4F' or '#fff') into [r, g, b].
 */
const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
      : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

// -----------------------------------------------------------------
// CIE LAB Color Space — perceptually uniform color distance
// -----------------------------------------------------------------

type Lab = [number, number, number]; // [L, a, b]

/** sRGB [0-255] → linear RGB [0-1] */
const srgbToLinear = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Linear RGB → CIE XYZ (D65 illuminant) */
const rgbToXyz = (r: number, g: number, b: number): [number, number, number] => {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  return [
    lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375,
    lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750,
    lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041,
  ];
};

/** XYZ → CIE LAB (D65 reference white) */
const xyzToLab = (x: number, y: number, z: number): Lab => {
  // D65 reference white
  const xn = 0.95047, yn = 1.00000, zn = 1.08883;
  const f = (t: number) => t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116;
  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

/** RGB [0-255] → CIE LAB */
const rgbToLab = (r: number, g: number, b: number): Lab => {
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
};

/** Delta-E (CIE76) — perceptual color distance in LAB space */
const deltaE = (lab1: Lab, lab2: Lab): number => {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
};

/**
 * Auto-detect the dominant background color by sampling 20 edge points
 * (4 corners + 4 edge midpoints + 12 evenly-spaced edge samples).
 * Clusters by Delta-E in LAB space, returns most common.
 */
export const autoDetectBgColor = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
): string => {
  const idx = (x: number, y: number) => (y * w + x) * 4;

  // 20 edge sample points — corners, midpoints, and evenly-spaced edge samples
  const samplePoints: Array<[number, number]> = [
    [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], // 4 corners
    [Math.floor(w / 2), 0], [Math.floor(w / 2), h - 1], // top/bottom mid
    [0, Math.floor(h / 2)], [w - 1, Math.floor(h / 2)], // left/right mid
  ];
  // Add 3 evenly-spaced samples per edge (12 extra)
  for (let i = 1; i <= 3; i++) {
    const xp = Math.floor((w * i) / 4);
    const yp = Math.floor((h * i) / 4);
    samplePoints.push([xp, 0], [xp, h - 1]); // top/bottom
    samplePoints.push([0, yp], [w - 1, yp]); // left/right
  }

  const samples: Array<[number, number, number]> = samplePoints.map(([x, y]) => {
    const i = idx(x, y);
    return [data[i], data[i + 1], data[i + 2]];
  });

  // Cluster in LAB space using Delta-E (fixed threshold, independent of tolerance)
  const thresh = 15; // Delta-E 15 groups similar edge colors together
  const clusters: Array<{ color: [number, number, number]; lab: Lab; count: number }> = [];
  for (const [r, g, b] of samples) {
    const lab = rgbToLab(r, g, b);
    let found = false;
    for (const cluster of clusters) {
      if (deltaE(lab, cluster.lab) <= thresh) {
        cluster.count++;
        found = true;
        break;
      }
    }
    if (!found) clusters.push({ color: [r, g, b], lab, count: 1 });
  }

  clusters.sort((a, b) => b.count - a.count);
  const [cr, cg, cb] = clusters[0].color;
  return `#${cr.toString(16).padStart(2, '0')}${cg.toString(16).padStart(2, '0')}${cb.toString(16).padStart(2, '0')}`.toUpperCase();
};

/**
 * Pre-compute Delta-E distance from target color for every pixel.
 * Returns Float32Array where each value is the Delta-E distance.
 * Avoids repeated rgbToLab() calls during BFS traversal.
 */
const precomputeDeltaEMap = (
  data: Uint8ClampedArray,
  total: number,
  targetLab: Lab,
): Float32Array => {
  const map = new Float32Array(total);
  for (let pi = 0; pi < total; pi++) {
    const i = pi * 4;
    if (data[i + 3] === 0) { map[pi] = 9999; continue; }
    const pixelLab = rgbToLab(data[i], data[i + 1], data[i + 2]);
    map[pi] = deltaE(pixelLab, targetLab);
  }
  return map;
};

/**
 * Find mask pixels connected to the image border via BFS.
 * Returns a new mask where only border-connected regions are marked.
 */
const borderConnectedMask = (mask: Uint8Array, w: number, h: number): Uint8Array => {
  const result = new Uint8Array(w * h);
  const queue: number[] = [];

  // Seed: all mask=1 pixels on the 4 image borders
  for (let x = 0; x < w; x++) {
    if (mask[x] === 1 && !result[x]) { result[x] = 1; queue.push(x); }
    const bottom = (h - 1) * w + x;
    if (mask[bottom] === 1 && !result[bottom]) { result[bottom] = 1; queue.push(bottom); }
  }
  for (let y = 1; y < h - 1; y++) {
    const left = y * w;
    if (mask[left] === 1 && !result[left]) { result[left] = 1; queue.push(left); }
    const right = y * w + w - 1;
    if (mask[right] === 1 && !result[right]) { result[right] = 1; queue.push(right); }
  }

  // BFS flood
  while (queue.length > 0) {
    const pi = queue.pop()!;
    const y = (pi / w) | 0;
    const x = pi % w;
    const neighbors = [
      y > 0 ? pi - w : -1,
      y < h - 1 ? pi + w : -1,
      x > 0 ? pi - 1 : -1,
      x < w - 1 ? pi + 1 : -1,
    ];
    for (const ni of neighbors) {
      if (ni >= 0 && mask[ni] === 1 && !result[ni]) {
        result[ni] = 1;
        queue.push(ni);
      }
    }
  }
  return result;
};

/**
 * Dilate a binary mask by N pixels, but ONLY expand border-connected regions.
 * Prevents interior holes from growing.
 */
const dilateMask = (mask: Uint8Array, w: number, h: number, amount: number): Uint8Array => {
  if (amount <= 0) return mask;

  // Only dilate the border-connected part of the mask
  const connected = borderConnectedMask(mask, w, h);
  let current = connected;

  for (let pass = 0; pass < amount; pass++) {
    const next = new Uint8Array(current.length);
    // Copy ALL original mask pixels (preserve interior matches)
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) next[i] = 1;
    }
    // Copy current connected+dilated pixels
    for (let i = 0; i < current.length; i++) {
      if (current[i] === 1) next[i] = 1;
    }
    // Dilate only from connected pixels
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const pi = y * w + x;
        if (next[pi] === 1) continue;
        if (
          (y > 0 && current[pi - w] === 1) ||
          (y < h - 1 && current[pi + w] === 1) ||
          (x > 0 && current[pi - 1] === 1) ||
          (x < w - 1 && current[pi + 1] === 1)
        ) {
          next[pi] = 1;
        }
      }
    }
    current = next;
  }
  return current;
};

/**
 * Feather (blur) a binary mask edge by N pixels using box blur on float mask.
 * Returns a Float32Array with values 0..1 representing removal strength.
 */
const featherMask = (
  mask: Uint8Array,
  w: number,
  h: number,
  amount: number,
): Float32Array => {
  const size = w * h;
  let buf = new Float32Array(size);
  for (let i = 0; i < size; i++) buf[i] = mask[i];
  if (amount <= 0) return buf;

  // Simple box blur passes
  for (let pass = 0; pass < amount; pass++) {
    const tmp = new Float32Array(size);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const pi = y * w + x;
        let sum = buf[pi];
        let count = 1;
        if (y > 0) { sum += buf[pi - w]; count++; }
        if (y < h - 1) { sum += buf[pi + w]; count++; }
        if (x > 0) { sum += buf[pi - 1]; count++; }
        if (x < w - 1) { sum += buf[pi + 1]; count++; }
        tmp[pi] = sum / count;
      }
    }
    buf = tmp;
  }
  return buf;
};

/**
 * Fill small interior transparent holes caused by color removal within design elements.
 * Only fills holes NOT connected to the image border and below maxHoleSize pixels.
 * Uses nearest-opaque-pixel propagation (not averaging) to avoid color blending artifacts.
 *
 * Small holes (< maxHoleSize) = damage from color removal → fill with nearest color.
 * Large holes = intentionally removed trapped BG → stay transparent.
 */
const fillSmallInteriorHoles = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  maxHoleSize: number = 500,
): void => {
  const total = w * h;

  // Find all transparent pixels
  const transparent = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (data[i * 4 + 3] === 0) transparent[i] = 1;
  }

  // BFS from border — find transparent pixels connected to edges (= real background)
  const borderConnected = new Uint8Array(total);
  const queue: number[] = [];
  for (let x = 0; x < w; x++) {
    if (transparent[x]) { borderConnected[x] = 1; queue.push(x); }
    const bot = (h - 1) * w + x;
    if (transparent[bot]) { borderConnected[bot] = 1; queue.push(bot); }
  }
  for (let y = 1; y < h - 1; y++) {
    const left = y * w;
    if (transparent[left]) { borderConnected[left] = 1; queue.push(left); }
    const right = y * w + w - 1;
    if (transparent[right]) { borderConnected[right] = 1; queue.push(right); }
  }
  while (queue.length > 0) {
    const pi = queue.pop()!;
    const x = pi % w, y = (pi / w) | 0;
    const nb = [
      y > 0 ? pi - w : -1, y < h - 1 ? pi + w : -1,
      x > 0 ? pi - 1 : -1, x < w - 1 ? pi + 1 : -1,
    ];
    for (const ni of nb) {
      if (ni >= 0 && transparent[ni] && !borderConnected[ni]) {
        borderConnected[ni] = 1;
        queue.push(ni);
      }
    }
  }

  // Connected component labeling on interior transparent pixels
  const labels = new Int32Array(total);
  let nextLabel = 1;
  const components: Map<number, number[]> = new Map();

  for (let pi = 0; pi < total; pi++) {
    if (!transparent[pi] || borderConnected[pi] || labels[pi] !== 0) continue;

    const label = nextLabel++;
    const componentQueue: number[] = [pi];
    const pixels: number[] = [];
    labels[pi] = label;

    while (componentQueue.length > 0) {
      const p = componentQueue.pop()!;
      pixels.push(p);
      const x = p % w, y = (p / w) | 0;
      const nb = [
        y > 0 ? p - w : -1, y < h - 1 ? p + w : -1,
        x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1,
      ];
      for (const ni of nb) {
        if (ni >= 0 && transparent[ni] && !borderConnected[ni] && labels[ni] === 0) {
          labels[ni] = label;
          componentQueue.push(ni);
        }
      }
    }
    components.set(label, pixels);
  }

  // Fill only small holes (< maxHoleSize) using nearest-opaque-pixel propagation
  for (const [, pixels] of components) {
    if (pixels.length > maxHoleSize) continue; // large hole = intentional, skip

    // Propagate from edges inward: each pass fills hole pixels adjacent to opaque pixels
    const holeSet = new Set(pixels);
    let remaining = new Set(pixels);

    for (let pass = 0; pass < 200 && remaining.size > 0; pass++) {
      const filled: Array<{ pi: number; r: number; g: number; b: number; a: number }> = [];

      for (const pi of remaining) {
        const x = pi % w, y = (pi / w) | 0;
        const nb = [
          y > 0 ? pi - w : -1, y < h - 1 ? pi + w : -1,
          x > 0 ? pi - 1 : -1, x < w - 1 ? pi + 1 : -1,
        ];

        // Find the nearest opaque neighbor (prefer non-hole pixels)
        let bestDist = Infinity;
        let bestR = 0, bestG = 0, bestB = 0, bestA = 0;

        for (const ni of nb) {
          if (ni < 0) continue;
          const a = data[ni * 4 + 3];
          if (a === 0 || holeSet.has(ni)) continue; // skip transparent/unfilled hole pixels
          // Nearest neighbor wins (all at distance 1, take first)
          if (1 < bestDist) {
            bestDist = 1;
            bestR = data[ni * 4];
            bestG = data[ni * 4 + 1];
            bestB = data[ni * 4 + 2];
            bestA = a;
          }
        }

        if (bestDist < Infinity) {
          filled.push({ pi, r: bestR, g: bestG, b: bestB, a: bestA });
        }
      }

      if (filled.length === 0) break;

      const nextRemaining = new Set(remaining);
      for (const { pi, r, g, b, a } of filled) {
        const i = pi * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
        holeSet.delete(pi);
        nextRemaining.delete(pi);
      }
      remaining = nextRemaining;
    }
  }
};

/**
 * After contiguous BFS removal, find ALL remaining matching-color pixels
 * that the BFS couldn't reach. These are trapped background pockets
 * enclosed by design elements.
 *
 * The BFS already removed everything reachable from edges.
 * Everything still matching = trapped BG. Protection comes from
 * the tolerance (Delta-E), not from cluster size.
 */
const findTrappedBackground = (
  deltaEMap: Float32Array,
  total: number,
  threshold: number,
  alreadyRemoved: Uint8Array,
): Uint8Array => {
  const trapped = new Uint8Array(total);
  for (let pi = 0; pi < total; pi++) {
    if (alreadyRemoved[pi] === 0 && deltaEMap[pi] <= threshold) {
      trapped[pi] = 1;
    }
  }
  return trapped;
};

/**
 * Replace RGB on semi-transparent edge pixels with nearest fully-opaque pixel's color.
 * Prevents "gray halo" when composited on a different background.
 * Only modifies pixels where 0 < alpha < 255 that are within `band` pixels of a transparent pixel.
 */
const decontaminateEdgeColors = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  band: number,
): void => {
  const total = w * h;

  // Build distance-to-transparency map via BFS (only process near-edge pixels)
  const dist = new Uint8Array(total);
  dist.fill(255);
  const queue: number[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pi = y * w + x;
      const a = data[pi * 4 + 3];
      if (a === 0) continue; // transparent pixel, skip
      if (a === 255) continue; // fully opaque, skip

      // Check if adjacent to a transparent pixel
      const hasTransp =
        (x > 0 && data[(pi - 1) * 4 + 3] === 0) ||
        (x < w - 1 && data[(pi + 1) * 4 + 3] === 0) ||
        (y > 0 && data[(pi - w) * 4 + 3] === 0) ||
        (y < h - 1 && data[(pi + w) * 4 + 3] === 0);

      if (hasTransp) {
        dist[pi] = 1;
        queue.push(pi);
      }
    }
  }

  // BFS expand to `band` pixels deep
  let head = 0;
  while (head < queue.length) {
    const pi = queue[head++];
    const d = dist[pi];
    if (d >= band) continue;
    const x = pi % w, y = (pi / w) | 0;
    const nb = [
      x > 0 ? pi - 1 : -1, x < w - 1 ? pi + 1 : -1,
      y > 0 ? pi - w : -1, y < h - 1 ? pi + w : -1,
    ];
    for (const ni of nb) {
      if (ni < 0 || dist[ni] <= d + 1) continue;
      const a = data[ni * 4 + 3];
      if (a === 0 || a === 255) continue; // only semi-transparent
      dist[ni] = d + 1;
      queue.push(ni);
    }
  }

  // For each semi-transparent edge pixel, find nearest fully-opaque pixel and copy RGB
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pi = y * w + x;
      if (dist[pi] > band) continue;

      const a = data[pi * 4 + 3];
      if (a === 0 || a === 255) continue;

      // Scan inward for nearest fully opaque pixel (search radius = band + 2)
      const searchR = band + 2;
      let bestR = -1, bestG = -1, bestB = -1;
      let bestDist = searchR + 1;

      for (let dy = -searchR; dy <= searchR; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -searchR; dx <= searchR; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const md = Math.abs(dx) + Math.abs(dy);
          if (md === 0 || md >= bestDist) continue;
          const ni = ny * w + nx;
          if (data[ni * 4 + 3] === 255) {
            bestR = data[ni * 4];
            bestG = data[ni * 4 + 1];
            bestB = data[ni * 4 + 2];
            bestDist = md;
          }
        }
      }

      if (bestR >= 0) {
        const idx = pi * 4;
        data[idx] = bestR;
        data[idx + 1] = bestG;
        data[idx + 2] = bestB;
        // Alpha stays unchanged
      }
    }
  }
};

/**
 * Run single-color removal on already-loaded imageData (in-place mutation).
 * Extracted from processColorRemoval to support multi-color sequential passes.
 */
const applySingleColorRemoval = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  colorHex: string,
  tolerance: number,
  softEdge: boolean,
  contiguous: boolean,
  fillHoles: boolean,
  edgeTrim: number,
  edgeFeather: number,
): void => {
  const [tr, tg, tb] = hexToRgb(colorHex);
  const targetLab = rgbToLab(tr, tg, tb);
  const threshold = tolerance * 0.8;
  const total = w * h;
  const deltaEMap = precomputeDeltaEMap(data, total, targetLab);

  if (contiguous) {
    const maxPasses = fillHoles ? 6 : 1;
    const removedMask = new Uint8Array(total);

    for (let pass = 0; pass < maxPasses; pass++) {
      const passThreshold = pass === 0 ? threshold : threshold * (0.95 ** pass);
      const mask = new Uint8Array(total);
      const visited = new Uint8Array(total);
      const queue: number[] = [];

      const matchesPixel = (pi: number): boolean => {
        if (data[pi * 4 + 3] === 0) return false;
        return deltaEMap[pi] <= passThreshold;
      };

      if (pass === 0) {
        for (let x = 0; x < w; x++) {
          const top = x, bot = (h - 1) * w + x;
          if (matchesPixel(top) && !visited[top]) { visited[top] = 1; queue.push(top); }
          if (matchesPixel(bot) && !visited[bot]) { visited[bot] = 1; queue.push(bot); }
        }
        for (let y = 1; y < h - 1; y++) {
          const left = y * w, right = y * w + (w - 1);
          if (matchesPixel(left) && !visited[left]) { visited[left] = 1; queue.push(left); }
          if (matchesPixel(right) && !visited[right]) { visited[right] = 1; queue.push(right); }
        }
      } else {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const pi = y * w + x;
            if (!removedMask[pi]) continue;
            const nb = [
              y > 0 ? pi - w : -1, y < h - 1 ? pi + w : -1,
              x > 0 ? pi - 1 : -1, x < w - 1 ? pi + 1 : -1,
            ];
            for (const ni of nb) {
              if (ni >= 0 && !visited[ni] && matchesPixel(ni)) {
                visited[ni] = 1;
                queue.push(ni);
              }
            }
          }
        }
      }

      while (queue.length > 0) {
        const pi = queue.pop()!;
        mask[pi] = 1;
        const x = pi % w, y = (pi / w) | 0;
        const nb = [
          y > 0 ? pi - w : -1, y < h - 1 ? pi + w : -1,
          x > 0 ? pi - 1 : -1, x < w - 1 ? pi + 1 : -1,
        ];
        for (const ni of nb) {
          if (ni >= 0 && !visited[ni] && matchesPixel(ni)) {
            visited[ni] = 1;
            queue.push(ni);
          }
        }
      }

      let newPixels = 0;
      for (let pi = 0; pi < total; pi++) {
        if (mask[pi] && !removedMask[pi]) newPixels++;
      }
      if (newPixels === 0 && pass > 0) break;

      for (let pi = 0; pi < total; pi++) {
        if (mask[pi]) removedMask[pi] = 1;
      }
    }

    if (fillHoles) {
      const trappedMask = findTrappedBackground(deltaEMap, total, threshold * 0.3, removedMask);
      for (let pi = 0; pi < total; pi++) {
        if (trappedMask[pi]) removedMask[pi] = 1;
      }
    }

    const dilated = dilateMask(removedMask, w, h, edgeTrim);
    const fMask = featherMask(dilated, w, h, edgeFeather);

    const softExtend = softEdge ? threshold * 0.3 : 0;
    const softStart = threshold * 0.6;
    const softEnd = threshold + softExtend;

    for (let pi = 0; pi < total; pi++) {
      const i = pi * 4;
      if (data[i + 3] === 0) continue;

      const strength = fMask[pi];
      const dist = deltaEMap[pi];
      const inMask = strength > 0;
      const wasDilated = removedMask[pi] === 0 && dilated[pi] === 1;

      if (wasDilated && inMask) {
        data[i + 3] = Math.round(data[i + 3] * (1 - strength));
      } else if (inMask && removedMask[pi] === 1) {
        if (softEdge && threshold > 0 && dist > softStart) {
          const t = Math.min((dist - softStart) / (softEnd - softStart), 1);
          data[i + 3] = Math.round(data[i + 3] * t);
        } else {
          data[i + 3] = Math.round(data[i + 3] * (1 - strength));
        }
      } else if (softEdge && dist <= softEnd && dist > threshold) {
        const t = (dist - threshold) / softExtend;
        data[i + 3] = Math.round(data[i + 3] * t);
      }
    }

    if (softEdge) {
      decontaminateEdgeColors(data, w, h, 4);
    }
  } else {
    const ncSoftExtend = softEdge ? threshold * 0.3 : 0;
    const ncSoftStart = threshold * 0.6;
    const ncSoftEnd = threshold + ncSoftExtend;

    for (let pi = 0; pi < total; pi++) {
      const i = pi * 4;
      if (data[i + 3] === 0) continue;
      const dist = deltaEMap[pi];

      if (dist <= ncSoftEnd) {
        if (softEdge && threshold > 0) {
          if (dist <= ncSoftStart) {
            data[i + 3] = 0;
          } else {
            const t = (dist - ncSoftStart) / (ncSoftEnd - ncSoftStart);
            data[i + 3] = Math.round(data[i + 3] * t);
          }
        } else if (dist <= threshold) {
          data[i + 3] = 0;
        }
      }
    }

    if (softEdge) {
      decontaminateEdgeColors(data, w, h, 4);
    }
  }

  if (fillHoles && !contiguous) {
    fillSmallInteriorHoles(data, w, h);
  }
};

/**
 * Upscale a canvas by factor using Pica.js (Lanczos3 filter).
 * Returns a new canvas at the scaled dimensions.
 */
const picaUpscale = async (
  srcCanvas: HTMLCanvasElement | OffscreenCanvas,
  factor: number,
): Promise<HTMLCanvasElement> => {
  const Pica = (await import('pica')).default;
  const pica = new Pica();
  const sw = ('width' in srcCanvas ? srcCanvas.width : 0);
  const sh = ('height' in srcCanvas ? srcCanvas.height : 0);
  const dstCanvas = createFallbackCanvas(Math.round(sw * factor), Math.round(sh * factor));
  // Pica requires HTMLCanvasElement — convert OffscreenCanvas if needed
  let htmlSrc: HTMLCanvasElement;
  if (srcCanvas instanceof HTMLCanvasElement) {
    htmlSrc = srcCanvas;
  } else {
    htmlSrc = createFallbackCanvas(sw, sh);
    const tmpCtx = htmlSrc.getContext('2d');
    if (tmpCtx) tmpCtx.drawImage(srcCanvas as unknown as ImageBitmapSource as CanvasImageSource, 0, 0);
  }
  await pica.resize(htmlSrc, dstCanvas as HTMLCanvasElement, { quality: 3 });
  return dstCanvas as HTMLCanvasElement;
};

/**
 * Remove target colors from an image. Supports multi-color (up to 3),
 * HD mode (Pica.js upscale for small images), and all existing features.
 * Returns the result as a PNG Blob.
 */
export const processColorRemoval = async (
  imageSource: string | Blob,
  params: ColorRemovalParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);
  const origW = img.naturalWidth;
  const origH = img.naturalHeight;

  // --- HD Mode: upscale small images for precision processing ---
  const shouldHd =
    params.hdMode === 'on' ||
    (params.hdMode === 'auto' && Math.max(origW, origH) < 3000);

  let workCanvas: HTMLCanvasElement;

  if (shouldHd) {
    // Draw original into a canvas, then upscale 2× with Pica
    const tmpCanvas = createFallbackCanvas(origW, origH);
    const tmpCtx = tmpCanvas.getContext('2d');
    if (!tmpCtx) throw new Error('Could not obtain 2D rendering context');
    tmpCtx.drawImage(img, 0, 0);
    workCanvas = await picaUpscale(tmpCanvas, 2);
  } else {
    workCanvas = createFallbackCanvas(origW, origH) as HTMLCanvasElement;
    const wCtx = workCanvas.getContext('2d');
    if (!wCtx) throw new Error('Could not obtain 2D rendering context');
    wCtx.drawImage(img, 0, 0);
  }

  const w = workCanvas.width;
  const h = workCanvas.height;
  const ctx = workCanvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;

  // Build color targets list — backward compat: use legacy fields if colors array empty
  const colors: ColorTarget[] =
    params.colors && params.colors.length > 0
      ? params.colors
      : [{ targetColor: params.targetColor, tolerance: params.tolerance, softEdge: params.softEdge }];

  // Process each color sequentially (COLOR 1 → 2 → 3)
  for (let ci = 0; ci < colors.length; ci++) {
    const ct = colors[ci];
    // First color in auto mode: detect from edges. Subsequent always use specified color
    const resolvedColor =
      ci === 0 && params.mode === 'auto'
        ? autoDetectBgColor(data, w, h)
        : ct.targetColor;

    applySingleColorRemoval(
      data, w, h,
      resolvedColor,
      ct.tolerance,
      ct.softEdge,
      params.contiguous,
      params.fillHoles,
      params.edgeTrim,
      params.edgeFeather,
    );
  }

  ctx.putImageData(imageData, 0, 0);

  // --- HD Mode: downscale back to original dimensions ---
  if (shouldHd) {
    const Pica = (await import('pica')).default;
    const pica = new Pica();
    const outCanvas = createFallbackCanvas(origW, origH);
    await pica.resize(workCanvas, outCanvas as HTMLCanvasElement, { quality: 3 });
    return canvasToBlob(outCanvas);
  }

  return canvasToBlob(workCanvas);
};

// -----------------------------------------------------------------
// Speckle Remover (Connected Component Labeling)
// -----------------------------------------------------------------

export interface SpeckleRemoverParams {
  minSize: number; // minimum connected pixel group size to KEEP, default 50
  connectivity: 4 | 8; // 4-connected (cardinal) or 8-connected (cardinal + diagonal), default 8
  alphaThreshold: number; // pixels with alpha below this are "empty", default 10
}

export const DEFAULT_SPECKLE_REMOVER_PARAMS: SpeckleRemoverParams = {
  minSize: 50,
  connectivity: 8,
  alphaThreshold: 10,
};

/** 4-connected neighbor offsets (dx, dy). */
const NEIGHBORS_4: ReadonlyArray<[number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

/** 8-connected neighbor offsets (dx, dy). */
const NEIGHBORS_8: ReadonlyArray<[number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

/**
 * Remove small speckles (isolated pixel groups) from an image by
 * connected component labeling via BFS flood fill.
 *
 * 1. Load source image, draw onto canvas
 * 2. Get ImageData, build labels array via BFS
 * 3. For every group smaller than `minSize`, set those pixels to alpha = 0
 * 4. Put modified ImageData back, export as PNG Blob
 */
export const processSpeckleRemover = async (
  imageSource: string | Blob,
  params: SpeckleRemoverParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = createFallbackCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not obtain 2D rendering context');

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;

  const totalPixels = w * h;
  const labels = new Int32Array(totalPixels); // 0 = unlabeled
  const groupSizes: number[] = [0]; // index 0 unused (label 0 = unlabeled)
  let currentLabel = 0;

  const neighbors = params.connectivity === 4 ? NEIGHBORS_4 : NEIGHBORS_8;

  // BFS queue — use a simple array-based queue with head pointer
  const queue = new Int32Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    // Skip already labeled or "empty" pixels
    if (labels[i] !== 0) continue;
    if (data[i * 4 + 3] <= params.alphaThreshold) continue;

    // Start new group via BFS
    currentLabel++;
    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    labels[i] = currentLabel;
    let size = 0;

    while (head < tail) {
      const idx = queue[head++];
      size++;

      const px = idx % w;
      const py = (idx - px) / w;

      for (const [dx, dy] of neighbors) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

        const nIdx = ny * w + nx;
        if (labels[nIdx] !== 0) continue;
        if (data[nIdx * 4 + 3] <= params.alphaThreshold) continue;

        labels[nIdx] = currentLabel;
        queue[tail++] = nIdx;
      }
    }

    groupSizes[currentLabel] = size;
  }

  // Remove speckles: set alpha = 0 for pixels in groups smaller than minSize
  for (let i = 0; i < totalPixels; i++) {
    const label = labels[i];
    if (label > 0 && groupSizes[label] < params.minSize) {
      data[i * 4 + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
};

// -----------------------------------------------------------------
// Transparency Cleaner
// -----------------------------------------------------------------

export type TransparencyCleanerHighlightColor = 'pink' | 'green' | 'cyan' | 'magenta';

export interface TransparencyCleanerParams {
  threshold: number; // 0–255, pixels with alpha below this become fully transparent, default 128
  mode: 'delete' | 'view'; // delete=remove pixels, view=highlight them
  highlightColor: TransparencyCleanerHighlightColor; // overlay color in view mode
  visibility: number; // 1–20, highlight intensity/border width in view mode, default 10
}

export const DEFAULT_TRANSPARENCY_CLEANER_PARAMS: TransparencyCleanerParams = {
  threshold: 128,
  mode: 'delete',
  highlightColor: 'pink',
  visibility: 10,
};

const CLEANER_HIGHLIGHT_MAP: Record<TransparencyCleanerHighlightColor, [number, number, number]> = {
  pink: [255, 105, 180],
  green: [0, 255, 128],
  cyan: [0, 200, 215],
  magenta: [255, 0, 255],
};

/**
 * Transparency Cleaner — two modes:
 * - delete: force alpha=0 for pixels with alpha below threshold
 * - view: highlight semi-transparent pixels with chosen color (non-destructive preview)
 * Returns the result as a PNG Blob.
 */
export const processTransparencyCleaner = async (
  imageSource: string | Blob,
  params: TransparencyCleanerParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = createFallbackCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not obtain 2D rendering context');

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;

  const { threshold, mode } = params;

  if (mode === 'view') {
    // View mode: highlight semi-transparent pixels
    const [hR, hG, hB] = CLEANER_HIGHLIGHT_MAP[params.highlightColor];
    const blendStrength = params.visibility / 20; // normalize 1–20 → 0.05–1.0

    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 0 && alpha < threshold) {
        // Blend highlight color with original pixel
        data[i] = Math.round(data[i] * (1 - blendStrength) + hR * blendStrength);
        data[i + 1] = Math.round(data[i + 1] * (1 - blendStrength) + hG * blendStrength);
        data[i + 2] = Math.round(data[i + 2] * (1 - blendStrength) + hB * blendStrength);
        data[i + 3] = 255; // make visible
      }
    }
  } else {
    // Delete mode: original behavior
    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      if (data[i + 3] < threshold) {
        data[i + 3] = 0;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
};

// -----------------------------------------------------------------
// Watermark
// -----------------------------------------------------------------

export interface WatermarkParams {
  text: string; // watermark text, default '' (empty = no text watermark)
  fontSize: number; // font size in px, default 48
  fontFamily: string; // font family, default 'Arial'
  color: string; // text color hex, default '#000000'
  opacity: number; // 0–100, default 30
  position:
    | 'center'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'tile'; // default 'center'
  rotation: number; // text rotation in degrees, default -30 (diagonal)
  tileSpacing: number; // spacing between tiles when position='tile', default 200
}

export const DEFAULT_WATERMARK_PARAMS: WatermarkParams = {
  text: '',
  fontSize: 48,
  fontFamily: 'Arial',
  color: '#000000',
  opacity: 30,
  position: 'center',
  rotation: -30,
  tileSpacing: 200,
};

/**
 * Apply a text watermark to an image. Returns the result as a PNG Blob.
 *
 * 1. Load source image, draw onto canvas at original size
 * 2. If `text` is empty, return original image unchanged
 * 3. Apply opacity, font, color, then draw text based on position mode
 * 4. Export as PNG Blob
 */
export const processWatermark = async (
  imageSource: string | Blob,
  params: WatermarkParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = createFallbackCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not obtain 2D rendering context');

  ctx.drawImage(img, 0, 0);

  // No text = return original unchanged
  if (!params.text.trim()) {
    return canvasToBlob(canvas);
  }

  const { text, fontSize, fontFamily, color, opacity, position, rotation } = params;
  const radians = (rotation * Math.PI) / 180;

  ctx.globalAlpha = opacity / 100;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const pad = 20;

  if (position === 'tile') {
    const spacing = params.tileSpacing;
    // Extend beyond canvas bounds to cover corners after rotation
    const diagonal = Math.sqrt(w * w + h * h);
    const startX = -diagonal / 2;
    const startY = -diagonal / 2;
    const endX = w + diagonal / 2;
    const endY = h + diagonal / 2;

    for (let y = startY; y < endY; y += spacing) {
      for (let x = startX; x < endX; x += spacing) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(radians);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
    }
  } else {
    let cx: number;
    let cy: number;

    switch (position) {
      case 'top-left':
        cx = pad + fontSize;
        cy = pad + fontSize / 2;
        break;
      case 'top-right':
        cx = w - pad - fontSize;
        cy = pad + fontSize / 2;
        break;
      case 'bottom-left':
        cx = pad + fontSize;
        cy = h - pad - fontSize / 2;
        break;
      case 'bottom-right':
        cx = w - pad - fontSize;
        cy = h - pad - fontSize / 2;
        break;
      case 'center':
      default:
        cx = w / 2;
        cy = h / 2;
        break;
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(radians);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  ctx.globalAlpha = 1;
  return canvasToBlob(canvas);
};

// -----------------------------------------------------------------
// Distress (Vintage / Used-Look Texture Overlay)
// -----------------------------------------------------------------

export interface DistressParams {
  intensity: number; // 0–100, how strong the distress effect, default 50
  grainAmount: number; // 0–100, noise grain overlay amount, default 30
  scratches: boolean; // add random scratch lines, default false
  edgeWear: boolean; // wear/fade edges, default true
  seed: number; // random seed for reproducibility, default 42
}

export const DEFAULT_DISTRESS_PARAMS: DistressParams = {
  intensity: 50,
  grainAmount: 30,
  scratches: false,
  edgeWear: true,
  seed: 42,
};

/**
 * Create a seeded PRNG (mulberry32 variant).
 * Returns a function that produces values in [0, 1).
 */
const createSeededRandom = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
};

/**
 * Apply distress / vintage texture overlay effects to an image.
 * Compositing approach: grain noise + edge wear (via ImageData),
 * then scratch lines drawn on top via canvas API.
 * Returns the result as a PNG Blob.
 */
export const processDistress = async (
  imageSource: string | Blob,
  params: DistressParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = createFallbackCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not obtain 2D rendering context');

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;

  const { intensity, grainAmount, scratches, edgeWear, seed } = params;
  const rng = createSeededRandom(seed);
  const intensityFactor = intensity / 100;

  // Pre-compute center and max distance for edge wear
  const cx = w / 2;
  const cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    // Skip fully transparent pixels
    if (data[i + 3] === 0) continue;

    // --- Grain effect ---
    if (grainAmount > 0) {
      const noise = (rng() - 0.5) * grainAmount * 2.55 * intensityFactor;
      data[i] = clamp(data[i] + noise, 0, 255);
      data[i + 1] = clamp(data[i + 1] + noise, 0, 255);
      data[i + 2] = clamp(data[i + 2] + noise, 0, 255);
    }

    // --- Edge wear ---
    if (edgeWear) {
      const pixelIndex = i / 4;
      const px = pixelIndex % w;
      const py = (pixelIndex - px) / w;

      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const edgeFactor = dist / maxDist;

      // Only apply wear in the outer region (edgeFactor > 0.5)
      if (edgeFactor > 0.5) {
        const wearStrength = (edgeFactor - 0.5) * 2; // remap 0.5-1 to 0-1
        data[i + 3] = Math.round(data[i + 3] * (1 - wearStrength * intensityFactor));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // --- Scratches ---
  if (scratches) {
    const scratchRng = createSeededRandom(seed + 7919); // offset seed
    const scratchCount = 3 + Math.floor(scratchRng() * 6); // 3–8 lines

    for (let s = 0; s < scratchCount; s++) {
      const x1 = scratchRng() * w;
      const y1 = scratchRng() * h;
      const x2 = scratchRng() * w;
      const y2 = scratchRng() * h;
      const lineWidth = 1 + scratchRng();
      const alpha = 0.1 + scratchRng() * 0.2 * intensityFactor;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  return canvasToBlob(canvas);
};

// -----------------------------------------------------------------
// Defringe (Auto-Detect Edge Cleanup)
// -----------------------------------------------------------------

export interface DefringeParams {
  shrinkPx: number;        // pixels to shrink edge inward, default 1
  detectThreshold: number; // alpha threshold for edge detection 0-255, default 128
  autoDetect: boolean;     // auto-detect optimal shrink value, default true
}

export const DEFAULT_DEFRINGE_PARAMS: DefringeParams = {
  shrinkPx: 1,
  detectThreshold: 128,
  autoDetect: true,
};

/**
 * Find edge pixel indices using 4-connectivity (cardinal neighbors).
 * An edge pixel is non-transparent (alpha > threshold) and has at
 * least one transparent neighbor (alpha <= threshold).
 * Returns a Set of flat pixel indices (NOT byte indices).
 */
const findEdgePixelIndices = (
  alphaValues: Uint8Array,
  w: number,
  h: number,
  threshold: number,
): Set<number> => {
  const edges = new Set<number>();

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (alphaValues[idx] <= threshold) continue;

      const hasTransparentNeighbor =
        (x > 0 && alphaValues[idx - 1] <= threshold) ||
        (x < w - 1 && alphaValues[idx + 1] <= threshold) ||
        (y > 0 && alphaValues[idx - w] <= threshold) ||
        (y < h - 1 && alphaValues[idx + w] <= threshold);

      if (hasTransparentNeighbor) {
        edges.add(idx);
      }
    }
  }

  return edges;
};

/**
 * Auto-detect optimal shrink value by analyzing color distance
 * between edge pixels and their inner neighbors.
 *
 * High average distance -> halo/fringe -> larger shrink (2-3).
 * Low distance -> clean edges -> shrink 1.
 */
const autoDetectShrink = (
  data: Uint8ClampedArray,
  alphaValues: Uint8Array,
  edges: Set<number>,
  w: number,
  h: number,
  threshold: number,
): number => {
  if (edges.size === 0) return 1;

  let totalDistance = 0;
  let count = 0;

  for (const idx of edges) {
    const px = idx % w;
    const py = Math.floor(idx / w);
    const bi = idx * 4;
    const edgeLab = rgbToLab(data[bi], data[bi + 1], data[bi + 2]);

    // Check 4-connected inner neighbors (non-edge, non-transparent)
    const neighbors: [number, number][] = [
      [px, py - 1], [px, py + 1], [px - 1, py], [px + 1, py],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = ny * w + nx;
      if (alphaValues[ni] <= threshold) continue;
      if (edges.has(ni)) continue;

      const nbi = ni * 4;
      const innerLab = rgbToLab(data[nbi], data[nbi + 1], data[nbi + 2]);
      totalDistance += deltaE(edgeLab, innerLab);
      count++;
    }
  }

  if (count === 0) return 1;
  const avgDist = totalDistance / count;

  // Delta-E based thresholds (perceptually uniform)
  // 0-15 -> 1px (clean), 15-35 -> 2px (moderate fringe), 35+ -> 3px (heavy)
  if (avgDist > 35) return 3;
  if (avgDist > 15) return 2;
  return 1;
};

/**
 * Remove fringe/halo artifacts from image edges.
 *
 * 1. Load image, draw onto canvas, get ImageData
 * 2. Find edge pixels using 4-connectivity
 * 3. If autoDetect: calculate optimal shrinkPx from color distance
 * 4. Erode inward by shrinkPx passes (set alpha to 0)
 * 5. Export as PNG Blob
 */
export const processDefringe = async (
  imageSource: string | Blob,
  params: DefringeParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = createFallbackCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not obtain 2D rendering context');

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;
  const totalPixels = w * h;

  const { detectThreshold, autoDetect } = params;
  let shrink = params.shrinkPx;

  // Build initial alpha snapshot
  const alphaSnapshot = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    alphaSnapshot[i] = data[i * 4 + 3];
  }

  // First pass edge detection
  const edges = findEdgePixelIndices(alphaSnapshot, w, h, detectThreshold);

  // Auto-detect optimal shrink
  if (autoDetect) {
    shrink = autoDetectShrink(data, alphaSnapshot, edges, w, h, detectThreshold);
  }

  if (shrink <= 0) {
    return canvasToBlob(canvas);
  }

  // Erode inward by shrink passes with gradual alpha fade.
  // Outer passes get full removal, inner passes get partial (smoother transition).
  for (let pass = 0; pass < shrink; pass++) {
    // Snapshot current alpha
    for (let i = 0; i < totalPixels; i++) {
      alphaSnapshot[i] = data[i * 4 + 3];
    }

    const currentEdges = pass === 0
      ? edges
      : findEdgePixelIndices(alphaSnapshot, w, h, detectThreshold);

    // Gradual fade: outermost pass = full removal, inner passes = partial
    const fadeRatio = shrink > 1 ? (shrink - pass) / shrink : 1;

    for (const idx of currentEdges) {
      const currentAlpha = data[idx * 4 + 3];
      data[idx * 4 + 3] = Math.round(currentAlpha * (1 - fadeRatio));
    }
  }

  // Color decontamination on defringe result
  decontaminateEdgeColors(data, w, h, shrink + 1);

  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
};

// -----------------------------------------------------------------
// Shrink (Edge Erosion)
// -----------------------------------------------------------------

export interface ShrinkParams {
  amount: number; // pixels to shrink, 0-5, default 1
  alphaThreshold: number; // alpha threshold for edge detection, default 128
}

export const DEFAULT_SHRINK_PARAMS: ShrinkParams = {
  amount: 1,
  alphaThreshold: 128,
};

/**
 * Shrink (erode) the visible area of an image by removing edge pixels.
 * Simple morphological erosion — repeat N times to shrink by N pixels.
 *
 * 1. Load image, draw onto canvas, get ImageData
 * 2. For each iteration (0 to amount-1):
 *    - Copy alpha channel
 *    - Find edge pixels: non-transparent with at least one transparent 4-neighbor
 *    - Set all edge pixels alpha = 0
 * 3. Put modified ImageData back, export as PNG Blob
 */
export const processShrink = async (
  imageSource: string | Blob,
  params: ShrinkParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = createFallbackCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not obtain 2D rendering context');

  ctx.drawImage(img, 0, 0);

  if (params.amount <= 0) {
    return canvasToBlob(canvas);
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;
  const totalPixels = w * h;
  const { amount, alphaThreshold } = params;

  for (let iter = 0; iter < amount; iter++) {
    // Snapshot current alpha values
    const alphaCopy = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      alphaCopy[i] = data[i * 4 + 3];
    }

    // Find and erase edge pixels
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (alphaCopy[idx] <= alphaThreshold) continue; // already transparent

        // Check 4-connected neighbors for transparency
        const hasTransparentNeighbor =
          (x > 0 && alphaCopy[idx - 1] <= alphaThreshold) ||
          (x < w - 1 && alphaCopy[idx + 1] <= alphaThreshold) ||
          (y > 0 && alphaCopy[idx - w] <= alphaThreshold) ||
          (y < h - 1 && alphaCopy[idx + w] <= alphaThreshold);

        if (hasTransparentNeighbor) {
          data[idx * 4 + 3] = 0;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
};

// -----------------------------------------------------------------
// Edge Cleaner (Anti-Alias Pass)
// -----------------------------------------------------------------

export interface EdgeCleanerParams {
  passes: number; // number of smoothing passes, 1-5, default 2
  alphaThreshold: number; // alpha threshold for edge detection, default 128
  strength: number; // smoothing strength 0-100, default 50
}

export const DEFAULT_EDGE_CLEANER_PARAMS: EdgeCleanerParams = {
  passes: 2,
  alphaThreshold: 128,
  strength: 50,
};

/**
 * Smooth jagged edges via multi-pass alpha averaging on edge pixels.
 * Only modifies alpha channel — RGB colors remain untouched.
 *
 * 1. Load image, draw onto canvas, get ImageData
 * 2. For each pass:
 *    - Find edge pixels (non-transparent with at least one transparent 4-neighbor)
 *    - Find near-edge pixels (within 1px of edge pixels)
 *    - Average alpha in a 3x3 kernel and blend with original
 * 3. Put modified ImageData back, export as PNG Blob
 */
export const processEdgeCleaner = async (
  imageSource: string | Blob,
  params: EdgeCleanerParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = createFallbackCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not obtain 2D rendering context');

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;

  const { passes, alphaThreshold, strength } = params;
  const blendFactor = strength / 100;

  for (let pass = 0; pass < passes; pass++) {
    // 1. Identify edge pixels
    const isEdge = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const alpha = data[idx * 4 + 3];
        if (alpha < alphaThreshold) continue;

        // Check 4-neighbors for transparency
        const hasTransparentNeighbor =
          (x > 0 && data[(y * w + x - 1) * 4 + 3] < alphaThreshold) ||
          (x < w - 1 && data[(y * w + x + 1) * 4 + 3] < alphaThreshold) ||
          (y > 0 && data[((y - 1) * w + x) * 4 + 3] < alphaThreshold) ||
          (y < h - 1 && data[((y + 1) * w + x) * 4 + 3] < alphaThreshold);

        if (hasTransparentNeighbor) {
          isEdge[idx] = 1;
        }
      }
    }

    // 2. Mark near-edge pixels (within 1px of edge pixels)
    const isTarget = new Uint8Array(isEdge);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (isTarget[y * w + x]) continue;
        for (let dy = -1; dy <= 1; dy++) {
          let found = false;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            if (isEdge[ny * w + nx]) {
              isTarget[y * w + x] = 1;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
    }

    // 3. Apply alpha smoothing to edge + near-edge pixels
    const alphaSnapshot = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      alphaSnapshot[i] = data[i * 4 + 3];
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!isTarget[idx]) continue;

        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            sum += alphaSnapshot[ny * w + nx];
            count++;
          }
        }
        const avgAlpha = sum / count;
        const original = alphaSnapshot[idx];
        data[idx * 4 + 3] = Math.round(
          original * (1 - blendFactor) + avgAlpha * blendFactor,
        );
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
};

// -----------------------------------------------------------------
// Color Defringe (Edge Color Replacement)
// -----------------------------------------------------------------

export interface ColorDefringeParams {
  edgeWidth: number; // how many pixels from edge to process, default 2
  alphaThreshold: number; // alpha threshold for edge detection, default 128
  colorTolerance: number; // 0-100, how aggressively to replace edge color, default 50
}

export const DEFAULT_COLOR_DEFRINGE_PARAMS: ColorDefringeParams = {
  edgeWidth: 2,
  alphaThreshold: 128,
  colorTolerance: 50,
};

/**
 * Replace semi-transparent edge pixel colors with the nearest inner
 * (fully opaque) pixel's RGB, preserving the original alpha.
 * Removes "color fringe" (e.g. white halo from background removal)
 * while keeping smooth anti-aliased edges.
 *
 * 1. Load image, draw onto canvas, get ImageData
 * 2. Detect edge band via BFS from transparent boundary
 * 3. For each semi-transparent edge pixel (0 < alpha < 255):
 *    - Find nearest fully opaque pixel by scanning inward
 *    - Replace RGB with inner pixel's RGB, keep original alpha
 * 4. Put modified ImageData back, export as PNG Blob
 */
export const processColorDefringe = async (
  imageSource: string | Blob,
  params: ColorDefringeParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = createFallbackCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not obtain 2D rendering context');

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;

  const { edgeWidth, alphaThreshold, colorTolerance } = params;
  const toleranceFactor = colorTolerance / 100;
  const maxSearchDist = edgeWidth + 4;

  // Build distance-to-transparent-boundary map via BFS
  const totalPixels = w * h;
  const dist = new Uint8Array(totalPixels);
  dist.fill(255);

  // Seed: non-transparent pixels adjacent to a transparent pixel
  const queue: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (data[idx * 4 + 3] === 0) continue;

      const hasTransparentNeighbor =
        (x === 0 || data[(y * w + (x - 1)) * 4 + 3] < alphaThreshold) ||
        (x === w - 1 || data[(y * w + (x + 1)) * 4 + 3] < alphaThreshold) ||
        (y === 0 || data[((y - 1) * w + x) * 4 + 3] < alphaThreshold) ||
        (y === h - 1 || data[((y + 1) * w + x) * 4 + 3] < alphaThreshold);

      if (hasTransparentNeighbor) {
        dist[idx] = 1;
        queue.push(idx);
      }
    }
  }

  // BFS expansion up to edgeWidth
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const d = dist[idx];
    if (d >= edgeWidth) continue;

    const x = idx % w;
    const y = (idx - x) / w;
    const neighbors = [
      y * w + (x - 1), y * w + (x + 1),
      (y - 1) * w + x, (y + 1) * w + x,
    ];
    const valid = [x > 0, x < w - 1, y > 0, y < h - 1];

    for (let i = 0; i < 4; i++) {
      if (!valid[i]) continue;
      const ni = neighbors[i];
      if (dist[ni] <= d + 1) continue;
      if (data[ni * 4 + 3] === 0) continue;
      dist[ni] = d + 1;
      queue.push(ni);
    }
  }

  // Replace edge pixel colors with nearest opaque pixel
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (dist[idx] > edgeWidth) continue;

      const alpha = data[idx * 4 + 3];
      if (alpha === 0 || alpha === 255) continue; // only semi-transparent

      // Scan inward to find nearest fully opaque pixel
      let foundR = -1;
      let foundG = -1;
      let foundB = -1;
      let bestDist = maxSearchDist + 1;

      for (let dy = -maxSearchDist; dy <= maxSearchDist; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -maxSearchDist; dx <= maxSearchDist; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const manhattan = Math.abs(dx) + Math.abs(dy);
          if (manhattan === 0 || manhattan >= bestDist) continue;

          const ni = ny * w + nx;
          if (data[ni * 4 + 3] === 255) {
            const nbi = ni * 4;
            foundR = data[nbi];
            foundG = data[nbi + 1];
            foundB = data[nbi + 2];
            bestDist = manhattan;
          }
        }
      }

      if (foundR >= 0) {
        const pIdx = idx * 4;
        data[pIdx] = Math.round(data[pIdx] + (foundR - data[pIdx]) * toleranceFactor);
        data[pIdx + 1] = Math.round(
          data[pIdx + 1] + (foundG - data[pIdx + 1]) * toleranceFactor,
        );
        data[pIdx + 2] = Math.round(
          data[pIdx + 2] + (foundB - data[pIdx + 2]) * toleranceFactor,
        );
        // Alpha stays unchanged
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
};

// -----------------------------------------------------------------
// Transparency Highlighter — Quality Control visualization overlay
// -----------------------------------------------------------------

export interface TransparencyHighlighterParams {
  highlightColor: 'red' | 'yellow' | 'magenta'; // overlay color for semi-transparent pixels, default 'red'
  fullyTransparentColor: string; // hex color for fully transparent areas, default '#222222'
  showOpaque: boolean; // if true, show opaque pixels normally; if false, dim them, default true
}

export const DEFAULT_TRANSPARENCY_HIGHLIGHTER_PARAMS: TransparencyHighlighterParams = {
  highlightColor: 'red',
  fullyTransparentColor: '#222222',
  showOpaque: true,
};

const HIGHLIGHT_COLOR_MAP: Record<TransparencyHighlighterParams['highlightColor'], [number, number, number]> = {
  red: [255, 0, 0],
  yellow: [255, 255, 0],
  magenta: [255, 0, 255],
};

/**
 * Parse a hex color string (e.g. '#222222') into [r, g, b].
 */
const parseHexColor = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
};

/**
 * Non-destructive visualization overlay that highlights transparency.
 * - Fully transparent (alpha=0): filled with fullyTransparentColor
 * - Semi-transparent (0<alpha<255): blended with highlightColor proportional to transparency
 * - Fully opaque (alpha=255): shown normally or dimmed based on showOpaque
 * All output pixels are fully opaque (alpha=255).
 */
export const processTransparencyHighlighter = async (
  imageSource: string | Blob,
  params: TransparencyHighlighterParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = createFallbackCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not obtain 2D rendering context');

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;

  const [hR, hG, hB] = HIGHLIGHT_COLOR_MAP[params.highlightColor];
  const [ftR, ftG, ftB] = parseHexColor(params.fullyTransparentColor);

  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    const alpha = data[i + 3];

    if (alpha === 0) {
      // Fully transparent → fill with fullyTransparentColor
      data[i] = ftR;
      data[i + 1] = ftG;
      data[i + 2] = ftB;
    } else if (alpha < 255) {
      // Semi-transparent → blend highlight color with original
      // More transparent = more highlight color
      const blendFactor = (255 - alpha) / 255;
      data[i] = Math.round(data[i] * (1 - blendFactor) + hR * blendFactor);
      data[i + 1] = Math.round(data[i + 1] * (1 - blendFactor) + hG * blendFactor);
      data[i + 2] = Math.round(data[i + 2] * (1 - blendFactor) + hB * blendFactor);
    } else if (!params.showOpaque) {
      // Fully opaque but showOpaque=false → dim by 50%
      data[i] = Math.round(data[i] * 0.5);
      data[i + 1] = Math.round(data[i + 1] * 0.5);
      data[i + 2] = Math.round(data[i + 2] * 0.5);
    }
    // else: alpha===255 && showOpaque → keep original RGB

    // All output pixels are fully opaque
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
};

// -----------------------------------------------------------------
// Eraser — Interactive canvas tool (not pipeline)
// -----------------------------------------------------------------

export interface EraserParams {
  size: number; // brush size in px, 1-100, default 20
  hardness: number; // 0-100, 100=hard edge, 0=soft feathered edge, default 100
}

export const DEFAULT_ERASER_PARAMS: EraserParams = {
  size: 20,
  hardness: 100,
};

/**
 * Erases pixels at given stroke positions (sets alpha=0 in circular brush area).
 * Hardness < 100 feathers the edges with gradual alpha falloff.
 */
export const processEraserStroke = async (
  imageSource: string | Blob,
  strokes: Array<{ x: number; y: number }>,
  params: EraserParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);
  const canvas = createFallbackCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  const radius = params.size / 2;
  const innerRadius = radius * (params.hardness / 100);

  for (const stroke of strokes) {
    const cx = Math.round(stroke.x);
    const cy = Math.round(stroke.y);
    const rCeil = Math.ceil(radius);

    const minX = Math.max(0, cx - rCeil);
    const maxX = Math.min(width - 1, cx + rCeil);
    const minY = Math.max(0, cy - rCeil);
    const maxY = Math.min(height - 1, cy + rCeil);

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > radius) continue;

        const idx = (py * width + px) * 4 + 3; // alpha channel

        if (params.hardness >= 100 || dist <= innerRadius) {
          data[idx] = 0;
        } else {
          const featherRange = radius - innerRadius;
          const factor = Math.max(0, 1 - (dist - innerRadius) / featherRange);
          data[idx] = Math.round(data[idx] * (1 - factor));
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
};

// -----------------------------------------------------------------
// Magic Wand — Interactive canvas tool (not pipeline)
// -----------------------------------------------------------------

export interface MagicWandParams {
  tolerance: number; // color similarity tolerance 0-100, default 30
  contiguous: boolean; // only select connected pixels, default true
  action: 'delete' | 'select'; // what to do with selection, default 'delete'
}

export const DEFAULT_MAGIC_WAND_PARAMS: MagicWandParams = {
  tolerance: 30,
  contiguous: true,
  action: 'delete',
};

/**
 * Selects/deletes pixels similar to the clicked pixel color.
 * Contiguous mode uses BFS flood fill; non-contiguous scans all pixels.
 */
export const processMagicWandClick = async (
  imageSource: string | Blob,
  clickX: number,
  clickY: number,
  params: MagicWandParams,
): Promise<Blob> => {
  const img = await loadImage(imageSource);
  const canvas = createFallbackCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  const cx = Math.round(clickX);
  const cy = Math.round(clickY);

  if (cx < 0 || cx >= width || cy < 0 || cy >= height) {
    return canvasToBlob(canvas);
  }

  const startIdx = (cy * width + cx) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];
  const targetA = data[startIdx + 3];

  // Scale tolerance 0-100 to 0-441 (sqrt(255^2 * 3) for RGB distance)
  const maxDist = params.tolerance * 4.41;

  const colorMatches = (idx: number): boolean => {
    const dr = data[idx] - targetR;
    const dg = data[idx + 1] - targetG;
    const db = data[idx + 2] - targetB;
    const da = data[idx + 3] - targetA;
    return Math.sqrt(dr * dr + dg * dg + db * db + da * da) <= maxDist;
  };

  const selected = new Uint8Array(width * height);

  if (params.contiguous) {
    const queue: number[] = [cy * width + cx];
    selected[cy * width + cx] = 1;

    while (queue.length > 0) {
      const pos = queue.shift()!;
      const px = pos % width;
      const py = Math.floor(pos / width);

      const neighbors = [
        py > 0 ? pos - width : -1,
        py < height - 1 ? pos + width : -1,
        px > 0 ? pos - 1 : -1,
        px < width - 1 ? pos + 1 : -1,
      ];

      for (const nPos of neighbors) {
        if (nPos < 0 || selected[nPos]) continue;
        if (colorMatches(nPos * 4)) {
          selected[nPos] = 1;
          queue.push(nPos);
        }
      }
    }
  } else {
    for (let i = 0; i < width * height; i++) {
      if (colorMatches(i * 4)) {
        selected[i] = 1;
      }
    }
  }

  if (params.action === 'delete') {
    for (let i = 0; i < width * height; i++) {
      if (selected[i]) {
        data[i * 4 + 3] = 0;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
};

// -----------------------------------------------------------------
// Shared canvas export helper
// -----------------------------------------------------------------

/**
 * Convert an HTMLCanvasElement or OffscreenCanvas to a PNG Blob.
 */
const canvasToBlob = (canvas: HTMLCanvasElement | OffscreenCanvas): Promise<Blob> => {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/png' });
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      },
      'image/png',
    );
  });
};

// -----------------------------------------------------------------
// Fallback Canvas (for environments without OffscreenCanvas)
// -----------------------------------------------------------------

const createFallbackCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

// -----------------------------------------------------------------
// Client-side Image Processing — Compressor
// Iterative quality/dimension reduction to hit a target file size.
// -----------------------------------------------------------------

export interface CompressorParams {
  maxSizeKb: number;       // target max file size in KB, default 2048 (2MB)
  quality: number;         // 0-100, initial quality for compression, default 80
  format: 'png' | 'webp';  // output format, default 'png'
}

export const DEFAULT_COMPRESSOR_PARAMS: CompressorParams = {
  maxSizeKb: 2048,
  quality: 80,
  format: 'png',
};

/**
 * Helper: export a canvas to a Blob with format + quality control.
 * PNG ignores quality (lossless); WebP uses quality param.
 */
const canvasToBlobWithFormat = (
  canvas: HTMLCanvasElement,
  format: 'png' | 'webp',
  quality: number,
): Promise<Blob> =>
  new Promise<Blob>((resolve, reject) => {
    const mimeType = format === 'webp' ? 'image/webp' : 'image/png';
    const qualityArg = format === 'webp' ? quality / 100 : undefined;
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      },
      mimeType,
      qualityArg,
    );
  });

/**
 * Compress an image by iteratively reducing quality (WebP) or
 * dimensions (PNG) until the blob fits within maxSizeKb.
 */
export const processCompressor = async (
  source: string | Blob,
  params: CompressorParams,
): Promise<Blob> => {
  const img = await loadImage(source);
  const maxBytes = params.maxSizeKb * 1024;

  let currentW = img.naturalWidth;
  let currentH = img.naturalHeight;
  let currentQuality = params.quality;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2d context');

  // Draw at current dimensions and export
  const drawAndExport = async (): Promise<Blob> => {
    canvas.width = currentW;
    canvas.height = currentH;
    ctx.clearRect(0, 0, currentW, currentH);
    ctx.drawImage(img, 0, 0, currentW, currentH);
    return canvasToBlobWithFormat(canvas, params.format, currentQuality);
  };

  let blob = await drawAndExport();

  if (params.format === 'webp') {
    // Reduce quality iteratively until under limit or quality bottoms out
    while (blob.size > maxBytes && currentQuality > 10) {
      currentQuality = Math.max(10, currentQuality - 10);
      blob = await drawAndExport();
    }
  } else {
    // PNG: reduce dimensions by 90% each iteration
    while (blob.size > maxBytes && currentW > 16 && currentH > 16) {
      currentW = Math.max(16, Math.round(currentW * 0.9));
      currentH = Math.max(16, Math.round(currentH * 0.9));
      blob = await drawAndExport();
    }
  }

  return blob;
};

// -----------------------------------------------------------------
// Pica Upscale (client-side Lanczos resampling via Pica.js)
// -----------------------------------------------------------------

export interface PicaUpscaleParams {
  targetWidth: number;
  targetHeight: number;
  filter: 'lanczos3' | 'lanczos2' | 'mks2013';
  unsharpAmount: number;
  unsharpRadius: number;
  unsharpThreshold: number;
}

export const DEFAULT_PICA_UPSCALE_PARAMS: PicaUpscaleParams = {
  targetWidth: 4500,
  targetHeight: 5400,
  filter: 'lanczos3',
  unsharpAmount: 0,
  unsharpRadius: 0,
  unsharpThreshold: 0,
};

/**
 * High-quality client-side upscale using Pica.js (Lanczos resampling).
 * Uses Web Workers + WASM for non-blocking performance.
 */
export const processPicaUpscale = async (
  source: string | Blob,
  params: PicaUpscaleParams,
): Promise<Blob> => {
  // Dynamic import to keep the singleton lazy
  const { getPicaInstance } = await import('./picaInstance');
  const pica = getPicaInstance();

  const img = await loadImage(source);

  // Draw source onto a canvas
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = img.naturalWidth;
  srcCanvas.height = img.naturalHeight;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) throw new Error('Failed to create source canvas context');
  srcCtx.drawImage(img, 0, 0);

  // Create target canvas
  const destCanvas = document.createElement('canvas');
  destCanvas.width = params.targetWidth;
  destCanvas.height = params.targetHeight;

  // Run Pica resize
  await pica.resize(srcCanvas, destCanvas, {
    filter: params.filter,
    unsharpAmount: params.unsharpAmount,
    unsharpRadius: params.unsharpRadius,
    unsharpThreshold: params.unsharpThreshold,
  });

  return pica.toBlob(destCanvas, 'image/png');
};
