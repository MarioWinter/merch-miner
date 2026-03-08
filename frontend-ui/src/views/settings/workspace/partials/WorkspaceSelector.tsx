import { MenuItem, Select, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { SettingsCard } from '../../../../components/SettingsCard';
import type { Workspace } from '../../../../services/workspaceService';

interface Props {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelect: (id: string) => void;
}

const WorkspaceSelector = ({ workspaces, activeWorkspaceId, onSelect }: Props) => {
  const { t } = useTranslation();

  if (workspaces.length <= 1) return null;

  return (
    <SettingsCard>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t('settings.workspace.activeWorkspace')}
      </Typography>
      <Select
        value={activeWorkspaceId}
        onChange={(e) => onSelect(e.target.value)}
        size="small"
        sx={{ minWidth: 240 }}
      >
        {workspaces.map((ws) => (
          <MenuItem key={ws.id} value={ws.id}>
            {ws.name}
          </MenuItem>
        ))}
      </Select>
    </SettingsCard>
  );
};

export default WorkspaceSelector;
