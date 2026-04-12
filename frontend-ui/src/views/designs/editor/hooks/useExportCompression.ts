import { useState, useCallback, useRef } from 'react';
import UPNG from 'upng-js';
import JSZip from 'jszip';
import type { BatchImage, CompressionLevel } from '../types';

// -----------------------------------------------------------------
// Compression level → UPNG color count mapping
// -----------------------------------------------------------------

const COMPRESSION_COLOR_COUNT: Record<CompressionLevel, number> = {
  off: 0,       // skip compression
  low: 4096,
  medium: 1024,
  high: 256,
  very_high: 128,
};

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const getImageUrl = (img: BatchImage): string =>
  img.processedUrl ?? img.previewUrl;

const replaceExtension = (filename: string, ext: string): string => {
  const lastDot = filename.lastIndexOf('.');
  const base = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  return `${base}${ext}`;
};

/**
 * Load an image URL into an HTMLCanvasElement and extract RGBA data.
 */
const urlToImageData = async (
  url: string,
): Promise<{ data: Uint8Array; width: number; height: number }> => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2d context');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    data: new Uint8Array(imageData.data.buffer),
    width: canvas.width,
    height: canvas.height,
  };
};

/**
 * Compress RGBA data using UPNG.js quantization.
 * Returns a PNG Blob.
 */
export const compressImage = (
  rgba: ArrayBuffer,
  width: number,
  height: number,
  level: CompressionLevel,
): Blob => {
  const colorCount = COMPRESSION_COLOR_COUNT[level];
  if (colorCount === 0) {
    // No compression — encode as standard PNG
    const encoded = UPNG.encode([rgba], width, height, 0);
    return new Blob([encoded], { type: 'image/png' });
  }
  const encoded = UPNG.encode([rgba], width, height, colorCount);
  return new Blob([encoded], { type: 'image/png' });
};

/**
 * Trigger a browser download for a Blob.
 */
const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// -----------------------------------------------------------------
// Hook interface
// -----------------------------------------------------------------

export interface UseExportCompressionReturn {
  isCompressing: boolean;
  progress: number;
  currentImageIndex: number;
  totalImages: number;
  downloadCurrent: (image: BatchImage, level: CompressionLevel) => Promise<void>;
  downloadAll: (images: BatchImage[], level: CompressionLevel) => Promise<void>;
  cancel: () => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

export const useExportCompression = (): UseExportCompressionReturn => {
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const cancelledRef = useRef(false);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const downloadCurrent = useCallback(async (image: BatchImage, level: CompressionLevel) => {
    setIsCompressing(true);
    setProgress(0);
    setCurrentImageIndex(1);
    setTotalImages(1);
    cancelledRef.current = false;

    try {
      const url = getImageUrl(image);

      if (level === 'off') {
        // No compression — direct download
        triggerDownload(
          await (await fetch(url)).blob(),
          replaceExtension(image.name, '.png'),
        );
        setProgress(100);
        return;
      }

      setProgress(20);
      const { data, width, height } = await urlToImageData(url);
      if (cancelledRef.current) return;

      setProgress(60);
      const blob = compressImage(data.buffer as ArrayBuffer, width, height, level);
      if (cancelledRef.current) return;

      setProgress(90);
      triggerDownload(blob, replaceExtension(image.name, '.png'));
      setProgress(100);
    } finally {
      setIsCompressing(false);
    }
  }, []);

  const downloadAll = useCallback(async (images: BatchImage[], level: CompressionLevel) => {
    if (images.length === 0) return;

    setIsCompressing(true);
    setProgress(0);
    setTotalImages(images.length);
    cancelledRef.current = false;

    try {
      const zip = new JSZip();

      for (let i = 0; i < images.length; i++) {
        if (cancelledRef.current) return;

        setCurrentImageIndex(i + 1);
        const img = images[i];
        const url = getImageUrl(img);
        const filename = replaceExtension(img.name, '.png');

        if (level === 'off') {
          const blob = await (await fetch(url)).blob();
          zip.file(filename, blob);
        } else {
          const { data, width, height } = await urlToImageData(url);
          const blob = compressImage(data.buffer as ArrayBuffer, width, height, level);
          zip.file(filename, blob);
        }

        // Progress: 80% for image processing, 20% for ZIP creation
        setProgress(Math.round(((i + 1) / images.length) * 80));
      }

      if (cancelledRef.current) return;

      const zipBlob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (meta) => {
          setProgress(80 + Math.round(meta.percent * 0.2));
        },
      );

      triggerDownload(zipBlob, 'designs-export.zip');
      setProgress(100);
    } finally {
      setIsCompressing(false);
    }
  }, []);

  return {
    isCompressing,
    progress,
    currentImageIndex,
    totalImages,
    downloadCurrent,
    downloadAll,
    cancel,
  };
};
