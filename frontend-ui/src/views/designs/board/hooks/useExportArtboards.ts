import { useCallback, useState } from 'react';
import JSZip from 'jszip';
import type { ArtboardData } from '../types';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface ExportSettings {
  /** Target DPI (default 300) */
  dpi: number;
  /** PNG quality 0-100 (mapped to canvas compression) */
  quality: number;
}

const DEFAULT_SETTINGS: ExportSettings = { dpi: 300, quality: 92 };

// Screen DPI baseline
const SCREEN_DPI = 72;

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const sanitizeFilename = (label: string) =>
  label.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');

/**
 * Render an artboard image onto an off-screen canvas at the target DPI,
 * then return a Blob.
 */
const renderArtboardToBlob = async (
  ab: ArtboardData,
  settings: ExportSettings,
): Promise<Blob | null> => {
  if (!ab.imageUrl) return null;

  const scale = settings.dpi / SCREEN_DPI;
  const outW = Math.round(ab.width * scale);
  const outH = Math.round(ab.height * scale);

  // Load the source image
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    if (ab.imageUrl!.startsWith('http')) {
      el.crossOrigin = 'anonymous';
    }
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Failed to load image: ${ab.imageUrl}`));
    el.src = ab.imageUrl!;
  });

  // Draw onto an off-screen canvas at target resolution
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background fill
  ctx.fillStyle = ab.backgroundColor || '#FFFFFF';
  ctx.fillRect(0, 0, outW, outH);

  // Draw image scaled to fill
  ctx.drawImage(img, 0, 0, outW, outH);

  // Export as PNG blob
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      'image/png',
      settings.quality / 100,
    );
  });
};

/** Trigger a browser download for a blob */
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useExportArtboards = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const exportArtboards = useCallback(
    async (artboards: ArtboardData[], settings: ExportSettings = DEFAULT_SETTINGS) => {
      if (artboards.length === 0) return;

      setIsExporting(true);
      setProgress(0);

      try {
        if (artboards.length === 1) {
          // Single artboard — download directly as PNG
          const blob = await renderArtboardToBlob(artboards[0], settings);
          if (blob) {
            const name = `${sanitizeFilename(artboards[0].label)}.png`;
            downloadBlob(blob, name);
          }
          setProgress(100);
        } else {
          // Multiple artboards — bundle as ZIP
          const zip = new JSZip();
          const folder = zip.folder('artboards');
          if (!folder) return;

          for (let i = 0; i < artboards.length; i++) {
            const ab = artboards[i];
            const blob = await renderArtboardToBlob(ab, settings);
            if (blob) {
              const name = `${String(i + 1).padStart(2, '0')}_${sanitizeFilename(ab.label)}.png`;
              folder.file(name, blob);
            }
            setProgress(Math.round(((i + 1) / artboards.length) * 90));
          }

          const zipBlob = await zip.generateAsync({ type: 'blob' });
          downloadBlob(zipBlob, 'artboards-export.zip');
          setProgress(100);
        }
      } finally {
        setIsExporting(false);
      }
    },
    [],
  );

  return { exportArtboards, isExporting, progress };
};

export default useExportArtboards;
