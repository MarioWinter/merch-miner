import { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useGetNicheQuery,
  useCreateNicheMutation,
  useUpdateNicheMutation,
  useDeleteNicheMutation,
} from '../../../../store/nicheSlice';
import { createNicheSchema, updateNicheSchema } from '../schemas/nicheSchema';
import type { CreateNicheFormValues, UpdateNicheFormValues } from '../schemas/nicheSchema';
import type { NicheUpdateBody } from '../types';
import type { DrawerMode } from './useNichePipeline';

interface UseNichePipelineDetailOptions {
  mode: DrawerMode;
  selectedId: string | null;
  onClose: () => void;
}

const extractErrorMessage = (error: unknown): string | null => {
  if (!error) return null;
  const e = error as { data?: unknown };
  if (!e.data || typeof e.data !== 'object') return null;
  const data = e.data as Record<string, unknown>;
  // DRF non-field error
  if (typeof data['detail'] === 'string') return data['detail'];
  // DRF field-keyed errors — pick the first field's first message
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (typeof val === 'string') return val;
    if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  }
  return null;
};

export const useNichePipelineDetail = ({
  mode,
  selectedId,
  onClose,
}: UseNichePipelineDetailOptions) => {
  const { t } = useTranslation();

  const { data: niche, isFetching, isError: fetchError } = useGetNicheQuery(selectedId ?? '', {
    skip: mode !== 'edit' || !selectedId,
  });
  const { enqueueSnackbar } = useSnackbar();

  const [createNiche, { isLoading: creating }] = useCreateNicheMutation();
  const [updateNiche, { isLoading: updating }] = useUpdateNicheMutation();
  const [deleteNiche, { isLoading: deleting }] = useDeleteNicheMutation();

  const [serverError, setServerError] = useState<string | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [linkedIdeasDialogOpen, setLinkedIdeasDialogOpen] = useState(false);
  const [linkedIdeaCount, setLinkedIdeaCount] = useState(0);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);

  const createForm = useForm<CreateNicheFormValues>({
    resolver: zodResolver(createNicheSchema),
    defaultValues: { name: '', notes: '' },
  });

  const editForm = useForm<UpdateNicheFormValues>({
    resolver: zodResolver(updateNicheSchema),
    defaultValues: {
      name: '',
      notes: '',
      status: 'data_entry',
      potential_rating: null,
      assigned_to: null,
    },
  });

  const { reset: resetEditForm } = editForm;
  const { reset: resetCreateForm } = createForm;

  // Populate edit form when niche data arrives
  useEffect(() => {
    if (mode === 'edit' && niche) {
      resetEditForm({
        name: niche.name,
        notes: niche.notes ?? '',
        status: niche.status,
        potential_rating: niche.potential_rating ?? null,
        assigned_to: niche.assigned_to,
      });
    }
  }, [niche, mode, resetEditForm]);

  // Reset create form on mode change to create
  useEffect(() => {
    if (mode === 'create') {
      resetCreateForm({ name: '', notes: '' });
    }
  }, [mode, resetCreateForm]);

  const handleCreate: SubmitHandler<CreateNicheFormValues> = async (values) => {
    setServerError(null);
    try {
      await createNiche(values).unwrap();
      enqueueSnackbar(t('niches.notifications.createSuccess'), { variant: 'success' });
      onClose();
    } catch (err) {
      const msg = extractErrorMessage(err);
      setServerError(msg ?? t('niches.notifications.createError'));
    }
  };

  const handleUpdate: SubmitHandler<UpdateNicheFormValues> = async (values) => {
    if (!selectedId) return;
    setServerError(null);
    const dirtyKeys = Object.keys(editForm.formState.dirtyFields) as (keyof UpdateNicheFormValues)[];
    if (dirtyKeys.length === 0) return;
    const body: Record<string, unknown> = {};
    for (const key of dirtyKeys) {
      body[key] = values[key];
    }
    try {
      await updateNiche({ id: selectedId, body: body as NicheUpdateBody }).unwrap();
      enqueueSnackbar(t('niches.notifications.updateSuccess'), { variant: 'success' });
    } catch (err) {
      const msg = extractErrorMessage(err);
      setServerError(msg ?? t('niches.notifications.updateError'));
    }
  };

  const handleArchiveConfirm = async () => {
    if (!selectedId) return;
    try {
      await deleteNiche({ id: selectedId }).unwrap();
      enqueueSnackbar(t('niches.notifications.archiveSuccess'), { variant: 'success' });
      setArchiveDialogOpen(false);
      onClose();
    } catch (err) {
      const e = err as { status?: number; data?: { has_linked_ideas?: boolean; idea_count?: number } };
      if (e.status === 409 && e.data?.has_linked_ideas) {
        setLinkedIdeaCount(e.data.idea_count ?? 0);
        setArchiveDialogOpen(false);
        setLinkedIdeasDialogOpen(true);
      } else {
        enqueueSnackbar(t('niches.notifications.archiveError'), { variant: 'error' });
      }
    }
  };

  const handleArchiveWithIdeas = async () => {
    if (!selectedId) return;
    try {
      await deleteNiche({ id: selectedId, confirmArchiveIdeas: true }).unwrap();
      enqueueSnackbar(t('niches.notifications.archiveWithIdeasSuccess'), { variant: 'success' });
      setLinkedIdeasDialogOpen(false);
      onClose();
    } catch {
      enqueueSnackbar(t('niches.notifications.archiveError'), { variant: 'error' });
    }
  };

  const handleLinkedIdeasCancel = () => {
    setLinkedIdeasDialogOpen(false);
    enqueueSnackbar(t('niches.notifications.archiveBlocked'), { variant: 'warning' });
  };

  // Subscribe to isDirty during render so react-hook-form tracks it via its proxy
  void createForm.formState.isDirty;
  void editForm.formState.isDirty;

  const requestClose = () => {
    const isDirty =
      mode === 'create' ? createForm.formState.isDirty : editForm.formState.isDirty;
    if (isDirty) {
      setUnsavedDialogOpen(true);
    } else {
      onClose();
    }
  };

  const discardAndClose = () => {
    setUnsavedDialogOpen(false);
    onClose();
  };

  return {
    niche,
    isFetching,
    fetchError,
    createForm,
    editForm,
    handleCreate,
    handleUpdate,
    creating,
    updating,
    deleting,
    serverError,
    archiveDialogOpen,
    setArchiveDialogOpen,
    linkedIdeasDialogOpen,
    setLinkedIdeasDialogOpen,
    linkedIdeaCount,
    handleArchiveConfirm,
    handleArchiveWithIdeas,
    handleLinkedIdeasCancel,
    unsavedDialogOpen,
    setUnsavedDialogOpen,
    requestClose,
    discardAndClose,
  };
};
