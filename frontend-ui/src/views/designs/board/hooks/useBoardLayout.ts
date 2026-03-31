import { useCallback, useRef, useState } from 'react';
import { useUpdateProjectMutation } from '../../../../store/designSlice';
import type { BoardLayout, ExternalImageDrop } from '../types';

const SAVE_DEBOUNCE_MS = 1500;

// Lightweight stand-ins for removed @xyflow/react types.
// Will be replaced by Konva-based layout types in Phase E.
interface LayoutNode {
  id: string;
  position: { x: number; y: number };
}

interface UseBoardLayoutParams {
  projectId: string;
  savedLayout: BoardLayout | null;
}

/**
 * Manages board node positions, debounced persistence to
 * DesignProject.board_layout via PATCH, hub management,
 * and external image drops.
 *
 * Note: React Flow-specific logic removed (Phase D1).
 * Will be adapted for Konva.js artboard in Phase E.
 */
export const useBoardLayout = ({
  projectId,
  savedLayout,
}: UseBoardLayoutParams) => {
  const [hubCount, setHubCount] = useState(1);
  const [externalImages, setExternalImages] = useState<ExternalImageDrop[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [updateProject] = useUpdateProjectMutation();

  const persistLayout = useCallback(
    (nodes: LayoutNode[]) => {
      if (!projectId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(() => {
        const layoutNodes = nodes.map((n) => ({
          id: n.id,
          x: n.position.x,
          y: n.position.y,
        }));

        void updateProject({
          projectId,
          body: { board_layout: { nodes: layoutNodes, edges: savedLayout?.edges ?? [] } },
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [projectId, updateProject, savedLayout],
  );

  const onNodesChange = useCallback(
    (nodes: LayoutNode[]) => {
      persistLayout(nodes);
    },
    [persistLayout],
  );

  const addHub = useCallback(() => {
    setHubCount((prev) => prev + 1);
  }, []);

  const addExternalImage = useCallback((file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setExternalImages((prev) => [
      ...prev,
      { file, previewUrl, name: file.name },
    ]);
  }, []);

  const handleExternalDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files);
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      for (const file of imageFiles) {
        addExternalImage(file);
      }
    },
    [addExternalImage],
  );

  return {
    hubCount,
    externalImages,
    onNodesChange,
    addHub,
    addExternalImage,
    handleExternalDrop,
  };
};
