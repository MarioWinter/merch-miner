import { useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useLazyListGalleryQuery } from '@/store/publishSlice';

/**
 * Fetches all designs in a given collection (root when collectionId is null)
 * and returns a merged id list (existing + new, de-duped, original order preserved).
 */
export const useAddDesignsFromCollection = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [triggerList] = useLazyListGalleryQuery();

  const addDesignsFromCollection = useCallback(
    async (collectionId: string | null, currentIds: string[]): Promise<string[]> => {
      try {
        const result = await triggerList(
          {
            page: 1,
            page_size: 200,
            collection: collectionId ?? undefined,
            sort_by: 'newest',
          },
          true,
        ).unwrap();

        const existing = new Set(currentIds);
        const additions = result.results
          .map((asset) => asset.id)
          .filter((id) => !existing.has(id));

        if (additions.length === 0) {
          enqueueSnackbar(
            t('publish.gallery.loadError', { defaultValue: 'No new designs to add' }),
            { variant: 'info' },
          );
          return currentIds;
        }

        return [...currentIds, ...additions];
      } catch {
        enqueueSnackbar(t('publish.gallery.loadError'), { variant: 'error' });
        return currentIds;
      }
    },
    [triggerList, enqueueSnackbar, t],
  );

  return { addDesignsFromCollection };
};
