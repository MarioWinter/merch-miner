import { useState, useCallback, useMemo } from 'react';
import {
  useListGalleryQuery,
  useUploadDesignMutation,
  useDeleteDesignMutation,
  useBulkActionMutation,
} from '@/store/publishSlice';
import type { GalleryListParams } from '../types';

export const useDesignGallery = () => {
  const [params, setParams] = useState<GalleryListParams>({
    page: 1,
    page_size: 24,
    sort_by: 'newest',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isFetching, error } = useListGalleryQuery(params);
  const [uploadDesign, { isLoading: isUploading }] = useUploadDesignMutation();
  const [deleteDesign] = useDeleteDesignMutation();
  const [bulkAction, { isLoading: isBulkProcessing }] = useBulkActionMutation();

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!data) return;
    setSelectedIds(new Set(data.results.map((d) => d.id)));
  }, [data]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const updateFilter = useCallback(
    (update: Partial<GalleryListParams>) => {
      setParams((prev) => ({ ...prev, ...update, page: update.page ?? 1 }));
    },
    [],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return uploadDesign(formData).unwrap();
    },
    [uploadDesign],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteDesign(id).unwrap();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [deleteDesign],
  );

  const handleBulkDelete = useCallback(async () => {
    await bulkAction({ ids: [...selectedIds], action: 'delete' }).unwrap();
    clearSelection();
  }, [bulkAction, selectedIds, clearSelection]);

  return useMemo(
    () => ({
      designs: data?.results ?? [],
      totalCount: data?.count ?? 0,
      isLoading,
      isFetching,
      error,
      params,
      selectedIds,
      isUploading,
      isBulkProcessing,
      toggleSelect,
      selectAll,
      clearSelection,
      updateFilter,
      handleUpload,
      handleDelete,
      handleBulkDelete,
    }),
    [
      data,
      isLoading,
      isFetching,
      error,
      params,
      selectedIds,
      isUploading,
      isBulkProcessing,
      toggleSelect,
      selectAll,
      clearSelection,
      updateFilter,
      handleUpload,
      handleDelete,
      handleBulkDelete,
    ],
  );
};
