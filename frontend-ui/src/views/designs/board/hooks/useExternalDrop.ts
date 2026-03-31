import { useCallback, useRef, useState } from 'react';
import { useUploadDesignToProjectMutation } from '@/store/designSlice';
import type { ArtboardData } from '../types';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const MAX_ARTBOARD_DIM = 600; // cap artboard to 600px in world space

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface UseExternalDropParams {
  projectId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
  addArtboard: (partial?: Partial<ArtboardData>) => ArtboardData;
  /** Update an existing artboard (e.g. replace blob URL with server URL) */
  updateArtboard?: (id: string, patch: Partial<ArtboardData>) => void;
}

interface UseExternalDropReturn {
  /** Whether an external file is currently being dragged over the canvas */
  isDraggingOver: boolean;
  /** Attach to CanvasContainer onDragOver */
  handleDragOver: (e: React.DragEvent) => void;
  /** Attach to CanvasContainer onDragEnter */
  handleDragEnter: (e: React.DragEvent) => void;
  /** Attach to CanvasContainer onDragLeave */
  handleDragLeave: (e: React.DragEvent) => void;
  /** Attach to CanvasContainer onDrop */
  handleDrop: (e: React.DragEvent) => void;
  /** Trigger a hidden file input (Browse Files button) */
  openFilePicker: () => void;
  /** Hidden input ref */
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  /** Handle file input change */
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const isImageFile = (file: File): boolean => ACCEPTED_TYPES.has(file.type);

/** Load an image to get its natural dimensions */
const loadImageDimensions = (url: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 280, height: 280 }); // fallback
    img.src = url;
  });

/** Scale dimensions to fit within MAX_ARTBOARD_DIM while preserving aspect ratio */
const fitDimensions = (w: number, h: number): { width: number; height: number } => {
  if (w <= MAX_ARTBOARD_DIM && h <= MAX_ARTBOARD_DIM) return { width: w, height: h };
  const scale = Math.min(MAX_ARTBOARD_DIM / w, MAX_ARTBOARD_DIM / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
};

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useExternalDrop = ({
  projectId,
  containerRef,
  screenToWorld,
  addArtboard,
  updateArtboard,
}: UseExternalDropParams): UseExternalDropReturn => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadDesign] = useUploadDesignToProjectMutation();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only respond to external file drops (not internal Konva drags)
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('Files')) return;
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
    }
  }, []);

  const createArtboardsFromFiles = useCallback(
    async (files: File[], worldX: number, worldY: number) => {
      const imageFiles = files.filter(isImageFile);
      let offsetX = 0;

      for (const file of imageFiles) {
        const previewUrl = URL.createObjectURL(file);
        const natural = await loadImageDimensions(previewUrl);
        const { width, height } = fitDimensions(natural.width, natural.height);
        const label = file.name.replace(/\.[^.]+$/, '');

        // Instant preview with blob URL
        const artboard = addArtboard({
          x: worldX + offsetX,
          y: worldY,
          width,
          height,
          label,
          imageUrl: previewUrl,
        });

        // Upload to server in background, replace blob URL with persistent URL
        if (projectId) {
          uploadDesign({ projectId, file })
            .unwrap()
            .then((design) => {
              URL.revokeObjectURL(previewUrl);
              updateArtboard?.(artboard.id, {
                imageUrl: design.image_file,
                designId: design.id,
              });
            })
            .catch(() => {
              // Keep blob URL as fallback — user sees the image but it won't persist
            });
        }

        offsetX += width + 40;
      }
    },
    [addArtboard, projectId, uploadDesign, updateArtboard],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDraggingOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const { x: worldX, y: worldY } = screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top,
      );

      void createArtboardsFromFiles(files, worldX, worldY);
    },
    [containerRef, screenToWorld, createArtboardsFromFiles],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      // Place at center of visible canvas
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { x: worldX, y: worldY } = screenToWorld(rect.width / 2, rect.height / 2);

      void createArtboardsFromFiles(files, worldX, worldY);

      // Reset so re-selecting the same file triggers change
      e.target.value = '';
    },
    [containerRef, screenToWorld, createArtboardsFromFiles],
  );

  return {
    isDraggingOver,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    openFilePicker,
    fileInputRef,
    handleFileInputChange,
  };
};

export default useExternalDrop;
