import { useCallback, useState } from 'react';
import type { ArtboardData } from '../types';
import { fitToMaxDimension } from '../utils/artboardSizing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface ContextMenuPosition {
  mouseX: number;
  mouseY: number;
}

interface ArtboardMenuState {
  position: ContextMenuPosition | null;
  artboardId: string | null;
}

interface CanvasMenuState {
  position: ContextMenuPosition | null;
  worldPosition: { x: number; y: number } | null;
}

interface UseContextMenuParams {
  containerRef: React.RefObject<HTMLDivElement | null>;
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
  addArtboard: (partial?: Partial<ArtboardData>) => ArtboardData;
}

interface UseContextMenuReturn {
  artboardMenu: ArtboardMenuState;
  canvasMenu: CanvasMenuState;
  /** Pass to Artboard onContextMenu prop */
  handleArtboardContextMenu: (id: string, evt: MouseEvent) => void;
  /** Pass to CanvasContainer onContextMenu */
  handleCanvasContextMenu: (e: React.MouseEvent) => void;
  /** Pass to CanvasContextMenu onAddArtboard */
  handleAddArtboardFromFile: (file: File, worldX: number, worldY: number) => void;
  closeArtboardMenu: () => void;
  closeCanvasMenu: () => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useContextMenu = ({
  containerRef,
  screenToWorld,
  addArtboard,
}: UseContextMenuParams): UseContextMenuReturn => {
  const [artboardMenu, setArtboardMenu] = useState<ArtboardMenuState>({
    position: null,
    artboardId: null,
  });

  const [canvasMenu, setCanvasMenu] = useState<CanvasMenuState>({
    position: null,
    worldPosition: null,
  });

  const handleArtboardContextMenu = useCallback(
    (artboardId: string, evt: MouseEvent) => {
      evt.preventDefault();
      setCanvasMenu({ position: null, worldPosition: null });
      setArtboardMenu({
        position: { mouseX: evt.clientX, mouseY: evt.clientY },
        artboardId,
      });
    },
    [],
  );

  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { x: worldX, y: worldY } = screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
      setArtboardMenu({ position: null, artboardId: null });
      setCanvasMenu({
        position: { mouseX: e.clientX, mouseY: e.clientY },
        worldPosition: { x: worldX, y: worldY },
      });
    },
    [containerRef, screenToWorld],
  );

  const handleAddArtboardFromFile = useCallback(
    (file: File, worldX: number, worldY: number) => {
      const previewUrl = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const { width, height } = fitToMaxDimension(img.naturalWidth, img.naturalHeight);
        addArtboard({
          x: worldX,
          y: worldY,
          width,
          height,
          label: file.name.replace(/\.[^.]+$/, ''),
          imageUrl: previewUrl,
        });
      };
      img.onerror = () => {
        addArtboard({
          x: worldX,
          y: worldY,
          label: file.name.replace(/\.[^.]+$/, ''),
          imageUrl: previewUrl,
        });
      };
      img.src = previewUrl;
    },
    [addArtboard],
  );

  const closeArtboardMenu = useCallback(() => {
    setArtboardMenu({ position: null, artboardId: null });
  }, []);

  const closeCanvasMenu = useCallback(() => {
    setCanvasMenu({ position: null, worldPosition: null });
  }, []);

  return {
    artboardMenu,
    canvasMenu,
    handleArtboardContextMenu,
    handleCanvasContextMenu,
    handleAddArtboardFromFile,
    closeArtboardMenu,
    closeCanvasMenu,
  };
};

export default useContextMenu;
