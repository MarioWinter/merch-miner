import { useCallback, useState } from 'react';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface EditorBatchItem {
  id: string;
  url: string;
  name: string;
  width?: number;
  height?: number;
}

export interface UseEditorBatchReturn {
  editorBatch: EditorBatchItem[];
  editorBatchCount: number;
  addToEditorBatch: (images: Omit<EditorBatchItem, 'id'>[]) => void;
  removeFromEditorBatch: (id: string) => void;
  clearEditorBatch: () => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useEditorBatch = (): UseEditorBatchReturn => {
  const [editorBatch, setEditorBatch] = useState<EditorBatchItem[]>([]);

  const addToEditorBatch = useCallback(
    (images: Omit<EditorBatchItem, 'id'>[]) => {
      const newItems: EditorBatchItem[] = images.map((img) => ({
        ...img,
        id: crypto.randomUUID(),
      }));
      setEditorBatch((prev) => [...prev, ...newItems]);
    },
    [],
  );

  const removeFromEditorBatch = useCallback((id: string) => {
    setEditorBatch((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearEditorBatch = useCallback(() => {
    setEditorBatch([]);
  }, []);

  return {
    editorBatch,
    editorBatchCount: editorBatch.length,
    addToEditorBatch,
    removeFromEditorBatch,
    clearEditorBatch,
  };
};

export default useEditorBatch;
