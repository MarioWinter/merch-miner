import { useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  fetchWorkspaces,
  renameWorkspace,
  changeMemberRole,
  removeMember,
  setActiveWorkspace,
} from '../../../../store/workspaceSlice';
import { workspaceService, type MemberRole } from '../../../../services/workspaceService';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';

export const useWorkspaceSection = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();

  const { workspaces, activeWorkspaceId, loading, error } = useAppSelector(
    (s) => s.workspace
  );

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const isAdmin = activeWorkspace?.role === 'admin';

  const [nameValue, setNameValue] = useState(activeWorkspace?.name ?? '');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  // Keep name field in sync when active workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      setNameValue(activeWorkspace.name);
    }
  }, [activeWorkspace?.id, activeWorkspace?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load on mount
  useEffect(() => {
    dispatch(fetchWorkspaces());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRenameSave = async () => {
    if (!activeWorkspace || !nameValue.trim()) return;
    try {
      await dispatch(
        renameWorkspace({ id: activeWorkspace.id, name: nameValue.trim() })
      ).unwrap();
      enqueueSnackbar(t('settings.workspace.saveSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('settings.workspace.saveError'), { variant: 'error' });
    }
  };

  const handleInvite = async () => {
    if (!activeWorkspace || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await workspaceService.inviteMember(activeWorkspace.id, inviteEmail.trim());
      setInviteEmail('');
      enqueueSnackbar(t('settings.workspace.inviteSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('settings.workspace.inviteError'), { variant: 'error' });
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: number, role: MemberRole) => {
    if (!activeWorkspace) return;
    try {
      await dispatch(
        changeMemberRole({ workspaceId: activeWorkspace.id, userId, role })
      ).unwrap();
      enqueueSnackbar(t('settings.workspace.roleChangeSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('settings.workspace.roleChangeError'), { variant: 'error' });
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!activeWorkspace) return;
    try {
      await dispatch(
        removeMember({ workspaceId: activeWorkspace.id, userId })
      ).unwrap();
      enqueueSnackbar(t('settings.workspace.removeSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('settings.workspace.removeError'), { variant: 'error' });
    }
  };

  const handleSelectWorkspace = (id: string) => {
    dispatch(setActiveWorkspace(id));
  };

  return {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    isAdmin,
    loading,
    error,
    nameValue,
    setNameValue,
    inviteEmail,
    setInviteEmail,
    inviting,
    handleRenameSave,
    handleInvite,
    handleRoleChange,
    handleRemoveMember,
    handleSelectWorkspace,
  };
};
