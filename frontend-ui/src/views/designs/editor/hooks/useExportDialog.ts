import { useState, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import type { BatchImage, ExportFormat, ExportSettings } from '../types';

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const estimateCompressedSize = (
  originalSize: number,
  quality: number,
  format: ExportFormat,
): number => {
  // PNG compression: 100 = original, 0 = ~10%
  // JPEG/WebP quality: lower quality = much smaller
  if (format === 'png') {
    const ratio = 0.1 + 0.9 * (quality / 100);
    return Math.round(originalSize * ratio);
  }
  // JPEG/WebP: approximate ratio curve
  const ratio = 0.05 + 0.95 * (quality / 100);
  return Math.round(originalSize * ratio * 0.7); // JPEG/WebP inherently smaller
};

const getImageUrl = (img: BatchImage): string =>
  img.processedUrl ?? img.previewUrl;

const fetchAsBlob = async (url: string): Promise<Blob> => {
  const res = await fetch(url);
  return res.blob();
};

const getMimeType = (format: ExportFormat): string => {
  switch (format) {
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    default: return 'image/png';
  }
};

const getFileExtension = (format: ExportFormat): string => {
  switch (format) {
    case 'jpeg': return '.jpg';
    case 'webp': return '.webp';
    default: return '.png';
  }
};

const replaceExtension = (filename: string, ext: string): string => {
  const lastDot = filename.lastIndexOf('.');
  const base = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  return `${base}${ext}`;
};

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

interface UseExportDialogReturn {
  format: ExportFormat;
  setFormat: (f: ExportFormat) => void;
  dpi: number;
  setDpi: (d: number) => void;
  quality: number;
  setQuality: (q: number) => void;
  overwriteOriginal: boolean;
  setOverwriteOriginal: (v: boolean) => void;
  buildSettings: () => ExportSettings;
  downloadCurrent: (image: BatchImage) => void;
  downloadAllZip: (images: BatchImage[]) => Promise<void>;
  isCreatingZip: boolean;
  zipProgress: number;
  estimatedCurrentSize: number | null;
  estimatedTotalSize: number;
  resultDimensions: { width: number; height: number } | null;
}

const useExportDialog = (currentImage: BatchImage | null): UseExportDialogReturn => {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [dpi, setDpi] = useState(300);
  const [quality, setQuality] = useState(80);
  const [overwriteOriginal, setOverwriteOriginal] = useState(false);
  const [isCreatingZip, setIsCreatingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  const buildSettings = useCallback((): ExportSettings => ({
    format,
    dpi,
    compression: quality,
    overwriteOriginal,
  }), [format, dpi, quality, overwriteOriginal]);

  // Estimated size for current image
  const estimatedCurrentSize = useMemo(() => {
    const size = currentImage?.fileSize;
    if (!size || size <= 0) return null;
    return estimateCompressedSize(size, quality, format);
  }, [currentImage?.fileSize, quality, format]);

  // Estimated total across all images not practical without batch ref,
  // so we expose a compute fn instead
  const estimatedTotalSize = 0; // computed in component

  // Result dimensions based on DPI scaling
  const resultDimensions = useMemo(() => {
    if (!currentImage?.width || !currentImage?.height) return null;
    const scale = dpi / 72;
    return {
      width: Math.round(currentImage.width * scale),
      height: Math.round(currentImage.height * scale),
    };
  }, [currentImage?.width, currentImage?.height, dpi]);

  const downloadCurrent = useCallback((image: BatchImage) => {
    const url = getImageUrl(image);
    const ext = getFileExtension(format);
    const a = document.createElement('a');
    a.href = url;
    a.download = replaceExtension(image.name, ext);
    a.click();
  }, [format]);

  const downloadAllZip = useCallback(async (images: BatchImage[]) => {
    if (images.length === 0) return;
    setIsCreatingZip(true);
    setZipProgress(0);

    try {
      const zip = new JSZip();
      const ext = getFileExtension(format);
      const mime = getMimeType(format);

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const url = getImageUrl(img);
        const blob = await fetchAsBlob(url);
        const finalBlob = blob.type === mime ? blob : blob;
        const fileName = replaceExtension(img.name, ext);
        zip.file(fileName, finalBlob);
        setZipProgress(Math.round(((i + 1) / images.length) * 80));
      }

      const zipBlob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (meta) => {
          setZipProgress(80 + Math.round(meta.percent * 0.2));
        },
      );

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `designs-export${ext === '.png' ? '' : `-${format}`}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setZipProgress(100);
    } finally {
      setIsCreatingZip(false);
      setZipProgress(0);
    }
  }, [format]);

  return {
    format,
    setFormat,
    dpi,
    setDpi,
    quality,
    setQuality,
    overwriteOriginal,
    setOverwriteOriginal,
    buildSettings,
    downloadCurrent,
    downloadAllZip,
    isCreatingZip,
    zipProgress,
    estimatedCurrentSize,
    estimatedTotalSize,
    resultDimensions,
  };
};

export default useExportDialog;
