import {
  Avatar,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { COLORS } from '../../../../style/constants';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import { useTranslation } from 'react-i18next';
import type { WorkspaceMember, MemberRole } from '../../../../services/workspaceService';

// ------------------------------------------------------------------
// Styled helpers
// ------------------------------------------------------------------

const RemoveIconButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.error.main,
  opacity: 0.7,
  '&:hover': {
    opacity: 1,
    backgroundColor: alpha(COLORS.errorLight, 0.08),
  },
  ...theme.applyStyles('dark', {
    '&:hover': {
      backgroundColor: alpha(COLORS.errorDk, 0.10),
    },
  }),
}));

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function RoleChip({ role }: { role: MemberRole }) {
  const { t } = useTranslation();
  return (
    <Chip
      label={
        role === 'admin'
          ? t('settings.workspace.roleAdmin')
          : t('settings.workspace.roleMember')
      }
      color={role === 'admin' ? 'primary' : 'default'}
      size="small"
    />
  );
}

function StatusChip({ status }: { status: 'active' | 'pending' }) {
  const { t } = useTranslation();
  return (
    <Chip
      label={
        status === 'active'
          ? t('settings.workspace.statusActive')
          : t('settings.workspace.statusPending')
      }
      color={status === 'active' ? 'success' : 'warning'}
      size="small"
    />
  );
}

// ------------------------------------------------------------------
// Main component
// ------------------------------------------------------------------

interface Props {
  members: WorkspaceMember[];
  isAdmin: boolean;
  onRoleChange: (userId: number, role: MemberRole) => void;
  onRemove: (userId: number) => void;
}

export default function MembersTable({ members, isAdmin, onRoleChange, onRemove }: Props) {
  const { t } = useTranslation();

  return (
    <TableContainer>
      <Table size="small" aria-label={t('settings.workspace.membersTitle')}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 40, pl: 0 }}>
              {t('settings.workspace.colAvatar')}
            </TableCell>
            <TableCell>{t('settings.workspace.colName')}</TableCell>
            <TableCell>{t('settings.workspace.colEmail')}</TableCell>
            <TableCell>{t('settings.workspace.colRole')}</TableCell>
            <TableCell>{t('settings.workspace.colStatus')}</TableCell>
            {isAdmin && (
              <TableCell align="right" sx={{ pr: 0 }}>
                {t('settings.workspace.colActions')}
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {members.map((member) => {
            const displayName =
              [member.first_name, member.last_name].filter(Boolean).join(' ') ||
              member.username;
            const initials =
              member.first_name?.charAt(0)?.toUpperCase() ||
              member.email?.charAt(0)?.toUpperCase() ||
              '?';

            return (
              <TableRow key={member.id}>
                <TableCell sx={{ pl: 0 }}>
                  <Avatar
                    src={member.avatar_url ?? undefined}
                    alt={displayName}
                    sx={{ width: 28, height: 28, fontSize: '0.75rem' }}
                  >
                    {!member.avatar_url && initials}
                  </Avatar>
                </TableCell>

                <TableCell>
                  <Typography variant="body2" noWrap>
                    {displayName}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {member.email}
                  </Typography>
                </TableCell>

                <TableCell>
                  {isAdmin && !member.is_owner ? (
                    <Select
                      value={member.role}
                      size="small"
                      variant="outlined"
                      onChange={(e) => onRoleChange(member.id, e.target.value as MemberRole)}
                      aria-label={`Role for ${displayName}`}
                      sx={{ fontSize: '0.8125rem', minWidth: 100 }}
                    >
                      <MenuItem value="admin">
                        {t('settings.workspace.roleAdmin')}
                      </MenuItem>
                      <MenuItem value="member">
                        {t('settings.workspace.roleMember')}
                      </MenuItem>
                    </Select>
                  ) : (
                    <RoleChip role={member.role} />
                  )}
                </TableCell>

                <TableCell>
                  <StatusChip status={member.status} />
                </TableCell>

                {isAdmin && (
                  <TableCell align="right" sx={{ pr: 0 }}>
                    {!member.is_owner && (
                      <Tooltip title={t('settings.workspace.removeMember')}>
                        <RemoveIconButton
                          size="small"
                          onClick={() => onRemove(member.id)}
                          aria-label={`${t('settings.workspace.removeMember')}: ${displayName}`}
                        >
                          <PersonRemoveOutlinedIcon sx={{ fontSize: 18 }} />
                        </RemoveIconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
