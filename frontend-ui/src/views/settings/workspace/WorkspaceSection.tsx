import { Alert, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { SettingsCard, SectionTitle } from '../../../components/SettingsCard';
import { useWorkspaceSection } from './hooks/useWorkspaceSection';
import WorkspaceSkeleton from './partials/WorkspaceSkeleton';
import WorkspaceSelector from './partials/WorkspaceSelector';
import WorkspaceNameCard from './partials/WorkspaceNameCard';
import MembersTable from './partials/MembersTable';
import InviteRow from './partials/InviteRow';

const WorkspaceSection = () => {
  const { t } = useTranslation();

  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    isAdmin,
    loading,
    error,
    inviting,
    handleRenameSave,
    handleInvite,
    handleRoleChange,
    handleRemoveMember,
    handleSelectWorkspace,
  } = useWorkspaceSection();

  if (loading) return <WorkspaceSkeleton />;

  if (error) {
    return (
      <SettingsCard>
        <Alert severity="error">{error}</Alert>
      </SettingsCard>
    );
  }

  if (!activeWorkspace) {
    return (
      <SettingsCard>
        <Typography variant="body2" color="text.secondary">
          {t('settings.workspace.noWorkspace')}
        </Typography>
      </SettingsCard>
    );
  }

  return (
    <Stack spacing={3}>
      <WorkspaceSelector
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId ?? ''}
        onSelect={handleSelectWorkspace}
      />

      <WorkspaceNameCard
        defaultName={activeWorkspace?.name ?? ''}
        isAdmin={isAdmin}
        onSave={handleRenameSave}
      />

      <SettingsCard>
        <SectionTitle>{t('settings.workspace.membersTitle')}</SectionTitle>

        <MembersTable
          members={activeWorkspace.members}
          isAdmin={isAdmin}
          onRoleChange={handleRoleChange}
          onRemove={handleRemoveMember}
        />

        {isAdmin && (
          <InviteRow
            inviting={inviting}
            onSubmit={handleInvite}
          />
        )}
      </SettingsCard>
    </Stack>
  );
};

export default WorkspaceSection;
