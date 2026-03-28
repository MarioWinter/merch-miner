import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Skeleton,
  Box,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { ToolPermission, PermissionLevel } from '../types';

const LevelGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButton-root': {
    textTransform: 'none',
    fontSize: '0.75rem',
    padding: theme.spacing(0.25, 1),
    border: 'none',
    borderRadius: `${theme.shape.borderRadius}px !important`,
    '&.Mui-selected': {
      backgroundColor: `rgba(255, 90, 79, 0.12)`,
      color: theme.vars.palette.primary.main,
    },
  },
}));

interface PermissionEditorProps {
  permissions: ToolPermission[];
  loading: boolean;
  onUpdate: (toolName: string, level: PermissionLevel) => void;
}

const PermissionEditor = ({ permissions, loading, onUpdate }: PermissionEditorProps) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={40} sx={{ mb: 1 }} />
        ))}
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {t('agent.settings.tool')}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {t('agent.settings.permissionLevel')}
              </Typography>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {permissions.map((perm) => (
            <TableRow key={perm.tool_name}>
              <TableCell>
                <Typography variant="body2">{perm.tool_name}</Typography>
                {perm.tool_description && (
                  <Typography variant="caption" color="text.secondary">
                    {perm.tool_description}
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">
                <LevelGroup
                  value={perm.permission_level}
                  exclusive
                  size="small"
                  onChange={(_, val: PermissionLevel | null) => {
                    if (val) onUpdate(perm.tool_name, val);
                  }}
                >
                  <ToggleButton value="auto">
                    {t('agent.settings.auto')}
                  </ToggleButton>
                  <ToggleButton value="notify">
                    {t('agent.settings.notify')}
                  </ToggleButton>
                  <ToggleButton value="approve">
                    {t('agent.settings.approveLevel')}
                  </ToggleButton>
                </LevelGroup>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default PermissionEditor;
