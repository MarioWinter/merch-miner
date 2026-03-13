import { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useCreateNicheMutation,
  useUpdateNicheMutation,
  useDeleteNicheMutation,
  useGetNicheQuery,
} from '../../../../store/nicheSlice';
import { createNicheSchema, updateNicheSchema } from '../schemas/nicheSchema';
import type { CreateNicheFormValues, UpdateNicheFormValues } from '../schemas/nicheSchema';
import type { DrawerMode } from './useNicheDrawer';

interface UseNicheDetailDrawerOptions {
  mode: DrawerMode;
  selectedId: string | null;
  onClose: () => void;
}

const extractErrorMessage = (error: unknown): string | null => {
  if (!error) return null;
  const e = error as { data?: { detail?: string; name?: string[] } };
  if (e.data?.detail) return e.data.detail;
  if (e.data?.name?.[0]) return e.data.name[0];
  return null;
};

export const useNicheDetailDrawer = ({
  mode,
  selectedId,
  onClose,
}: UseNicheDetailDrawerOptions) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const { data: niche, isFetching } = useGetNicheQuery(selectedId ?? '', {
    skip: mode !== 'edit' || !selectedId,
  });

  const [createNiche, { isLoading: creating }] = useCreateNicheMutation();
  const [updateNiche, { isLoading: updating }] = useUpdateNicheMutation();
  const [deleteNiche, { isLoading: deleting }] = useDeleteNicheMutation();

  const [serverError, setServerError] = useState<string | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);

  const createForm = useForm<CreateNicheFormValues>({
    resolver: zodResolver(createNicheSchema),
    defaultValues: { name: '', notes: '' },
  });

  const editForm = useForm<UpdateNicheFormValues>({
    resolver: zodResolver(updateNicheSchema),
    defaultValues: {},
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
    try {
      await updateNiche({ id: selectedId, body: values }).unwrap();
      enqueueSnackbar(t('niches.notifications.updateSuccess'), { variant: 'success' });
    } catch (err) {
      const msg = extractErrorMessage(err);
      setServerError(msg ?? t('niches.notifications.updateError'));
    }
  };

  const handleArchiveConfirm = async () => {
    if (!selectedId) return;
    try {
      await deleteNiche(selectedId).unwrap();
      enqueueSnackbar(t('niches.notifications.archiveSuccess'), { variant: 'success' });
      setArchiveDialogOpen(false);
      onClose();
    } catch {
      enqueueSnackbar(t('niches.notifications.archiveError'), { variant: 'error' });
    }
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
    unsavedDialogOpen,
    setUnsavedDialogOpen,
    handleArchiveConfirm,
    requestClose,
    discardAndClose,
  };
};
