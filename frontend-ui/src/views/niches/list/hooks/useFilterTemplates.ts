import { useCallback, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useListFilterTemplatesQuery,
  useCreateFilterTemplateMutation,
  useUpdateFilterTemplateMutation,
  useDeleteFilterTemplateMutation,
} from '../../../../store/nicheSlice';
import type { UseNicheFiltersReturn, NicheFilters } from './useNicheFilters';
import type { FilterTemplate } from '../types';

export interface UseFilterTemplatesReturn {
  templates: FilterTemplate[];
  isLoading: boolean;
  activeTemplateId: string | null;
  applyTemplate: (template: FilterTemplate) => void;
  saveCurrentFilters: (name: string) => Promise<void>;
  updateTemplate: (id: string) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
}

export const useFilterTemplates = (
  filterState: UseNicheFiltersReturn,
): UseFilterTemplatesReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useListFilterTemplatesQuery();
  const [createTemplate] = useCreateFilterTemplateMutation();
  const [updateTemplateMutation] = useUpdateFilterTemplateMutation();
  const [deleteTemplateMutation] = useDeleteFilterTemplateMutation();

  const applyTemplate = useCallback(
    (template: FilterTemplate) => {
      filterState.applyFilters(template.filters);
      setActiveTemplateId(template.id);
    },
    [filterState],
  );

  const getCurrentFilters = (): Partial<NicheFilters> => {
    const { filters } = filterState;
    const result: Partial<NicheFilters> = {};
    if (filters.search) result.search = filters.search;
    if (filters.status) result.status = filters.status;
    if (filters.status_group) result.status_group = filters.status_group;
    if (filters.potential_rating) result.potential_rating = filters.potential_rating;
    if (filters.assigned_to) result.assigned_to = filters.assigned_to;
    if (filters.ordering) result.ordering = filters.ordering;
    return result;
  };

  const saveCurrentFilters = useCallback(
    async (name: string) => {
      const filters = getCurrentFilters();
      try {
        const created = await createTemplate({ name, filters }).unwrap();
        setActiveTemplateId(created.id);
        enqueueSnackbar(t('niches.filterTemplates.saveSuccess'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('niches.filterTemplates.saveError'), { variant: 'error' });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [createTemplate, enqueueSnackbar, t, filterState.filters],
  );

  const updateTemplate = useCallback(
    async (id: string) => {
      const filters = getCurrentFilters();
      try {
        await updateTemplateMutation({ id, filters }).unwrap();
        enqueueSnackbar(t('niches.filterTemplates.updateSuccess'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('niches.filterTemplates.updateError'), { variant: 'error' });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateTemplateMutation, enqueueSnackbar, t, filterState.filters],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      try {
        await deleteTemplateMutation(id).unwrap();
        if (activeTemplateId === id) setActiveTemplateId(null);
        enqueueSnackbar(t('niches.filterTemplates.deleteSuccess'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('niches.filterTemplates.deleteError'), { variant: 'error' });
      }
    },
    [deleteTemplateMutation, activeTemplateId, enqueueSnackbar, t],
  );

  return {
    templates,
    isLoading,
    activeTemplateId,
    applyTemplate,
    saveCurrentFilters,
    updateTemplate,
    deleteTemplate,
  };
};
