import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useUpdateProjectMutation } from '@/store/designSlice';

interface UseProjectNameEditArgs {
  projectId: string | undefined;
  currentName: string | undefined;
}

/**
 * Inline-edit state for the project name in the workspace header. Tracks
 * editing flag + draft value; commits via the existing
 * `useUpdateProjectMutation`. Surface a snackbar on failure.
 */
export const useProjectNameEdit = ({ projectId, currentName }: UseProjectNameEditArgs) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [updateProject] = useUpdateProjectMutation();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');

  const startEdit = () => {
    setEditingName(currentName ?? '');
    setIsEditingName(true);
  };

  const save = async () => {
    const trimmed = editingName.trim();
    setIsEditingName(false);
    if (!trimmed || !projectId || trimmed === currentName) return;
    try {
      await updateProject({ projectId, body: { name: trimmed } }).unwrap();
    } catch {
      enqueueSnackbar(
        t('design.workspace.renameError', 'Failed to rename project'),
        { variant: 'error' },
      );
    }
  };

  return {
    isEditingName,
    editingName,
    setEditingName,
    startEdit,
    save,
  };
};

export default useProjectNameEdit;
