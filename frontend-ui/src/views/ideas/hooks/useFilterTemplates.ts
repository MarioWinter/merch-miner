import { useCallback, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useListIdeaFilterTemplatesQuery,
  useCreateIdeaFilterTemplateMutation,
  useUpdateIdeaFilterTemplateMutation,
  useDeleteIdeaFilterTemplateMutation,
} from '@/store/ideaSlice';
import type { UseIdeaFiltersReturn } from './useIdeaFilters';
import type { IdeaFilterTemplate, IdeaFilters } from '../types';

export interface UseIdeaFilterTemplatesReturn {
  templates: IdeaFilterTemplate[];
  isLoading: boolean;
  activeTemplateId: string | null;
  applyTemplate: (template: IdeaFilterTemplate) => void;
  saveCurrentFilters: (name: string) => Promise<void>;
  updateTemplate: (id: string) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
}

export const useIdeaFilterTemplates = (
  filterState: UseIdeaFiltersReturn,
): UseIdeaFilterTemplatesReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useListIdeaFilterTemplatesQuery();
  const [createTemplate] = useCreateIdeaFilterTemplateMutation();
  const [updateTemplateMutation] = useUpdateIdeaFilterTemplateMutation();
  const [deleteTemplateMutation] = useDeleteIdeaFilterTemplateMutation();

  const applyTemplate = useCallback(
    (template: IdeaFilterTemplate) => {
      filterState.applyFilters(template.filters);
      setActiveTemplateId(template.id);
    },
    [filterState],
  );

  const getCurrentFilters = (): Partial<IdeaFilters> => {
    const { filters } = filterState;
    const result: Partial<IdeaFilters> = {};
    if (filters.niche_id) result.niche_id = filters.niche_id;
    if (filters.status) result.status = filters.status;
    if (filters.signal_type) result.signal_type = filters.signal_type;
    if (filters.ordering) result.ordering = filters.ordering;
    return result;
  };

  const saveCurrentFilters = useCallback(
    async (name: string) => {
      const filters = getCurrentFilters();
      try {
        const created = await createTemplate({ name, filters }).unwrap();
        setActiveTemplateId(created.id);
        enqueueSnackbar(t('ideas.filterTemplate.saveSuccess'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('ideas.filterTemplate.saveError'), { variant: 'error' });
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
        enqueueSnackbar(t('ideas.filterTemplate.updateSuccess'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('ideas.filterTemplate.updateError'), { variant: 'error' });
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
        enqueueSnackbar(t('ideas.filterTemplate.deleteSuccess'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('ideas.filterTemplate.deleteError'), { variant: 'error' });
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
