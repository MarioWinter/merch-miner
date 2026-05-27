/**
 * PROJ-30 T3.12 — vertical card list mirroring MembersTable rows for
 * `<744px` viewports. No bulk-select (parent table doesn't expose one).
 */
import { useState } from 'react';
import {
  Avatar,
  Box,
  Chip,
  Menu,
  MenuItem,
  Stack,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import { useTranslation } from 'react-i18next';
import { MobileCard } from '@/components/MobileCard';
import type {
  WorkspaceMember,
  MemberRole,
} from '@/services/workspaceService';

interface MembersCardListProps {
  members: WorkspaceMember[];
  isAdmin: boolean;
  onRoleChange: (userId: number, role: MemberRole) => void;
  onRemove: (userId: number) => void;
}

const DestructiveMenuItem = styled(MenuItem)(({ theme }) => ({
  color: theme.vars.palette.error.main,
  gap: theme.spacing(1),
  '&:hover': {
    backgroundColor: `rgba(${theme.vars.palette.error.mainChannel} / 0.08)`,
  },
}));

const TitleCluster = styled(Stack)({
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  flex: 1,
});

const NameText = styled(Box)({
  fontWeight: 600,
  fontSize: '0.9375rem',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const StatusChip = ({ status }: { status: 'active' | 'pending' }) => {
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
};

const RoleChip = ({ role }: { role: MemberRole }) => {
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
};

const getDisplayName = (m: WorkspaceMember): string => {
  const joined = [m.first_name, m.last_name].filter(Boolean).join(' ');
  return joined || m.username || m.email;
};

const getInitials = (m: WorkspaceMember): string =>
  m.first_name?.charAt(0)?.toUpperCase() ||
  m.email?.charAt(0)?.toUpperCase() ||
  '?';

interface MemberMenuState {
  anchor: HTMLElement | null;
  member: WorkspaceMember | null;
}

export const MembersCardList = ({
  members,
  isAdmin,
  onRoleChange,
  onRemove,
}: MembersCardListProps) => {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<MemberMenuState>({ anchor: null, member: null });

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>, m: WorkspaceMember) => {
    setMenu({ anchor: e.currentTarget, member: m });
  };

  const closeMenu = () => setMenu({ anchor: null, member: null });

  const handleRole = (role: MemberRole) => {
    if (menu.member) onRoleChange(menu.member.id, role);
    closeMenu();
  };

  const handleRemove = () => {
    if (menu.member) onRemove(menu.member.id);
    closeMenu();
  };

  const showActionsForMember = (m: WorkspaceMember): boolean => isAdmin && !m.is_owner;

  return (
    <>
      <Stack spacing={1} role="list" aria-label={t('settings.workspace.membersTitle')}>
        {members.map((member) => {
          const displayName = getDisplayName(member);
          return (
            <MobileCard
              key={member.id}
              title={
                <TitleCluster>
                  <Avatar
                    src={member.avatar_url ?? undefined}
                    alt={displayName}
                    sx={{ width: 32, height: 32, fontSize: '0.875rem' }}
                  >
                    {!member.avatar_url && getInitials(member)}
                  </Avatar>
                  <NameText>{displayName}</NameText>
                </TitleCluster>
              }
              primaryMeta={member.email}
              chips={
                <>
                  <RoleChip role={member.role} />
                  <StatusChip status={member.status} />
                </>
              }
              onMenuOpen={
                showActionsForMember(member)
                  ? (e) => openMenu(e, member)
                  : undefined
              }
              menuAriaLabel={t('responsive.cardList.actionsAria', { title: displayName })}
            />
          );
        })}
      </Stack>

      <Menu
        anchorEl={menu.anchor}
        open={Boolean(menu.anchor)}
        onClose={closeMenu}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      >
        <MenuItem onClick={() => handleRole('admin')}>
          <AdminPanelSettingsOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
          {t('settings.workspace.roleAdmin')}
        </MenuItem>
        <MenuItem onClick={() => handleRole('member')}>
          <PersonOutlineRoundedIcon fontSize="small" sx={{ mr: 1 }} />
          {t('settings.workspace.roleMember')}
        </MenuItem>
        <DestructiveMenuItem onClick={handleRemove}>
          <PersonRemoveOutlinedIcon fontSize="small" />
          {t('settings.workspace.removeMember')}
        </DestructiveMenuItem>
      </Menu>
    </>
  );
};

export default MembersCardList;
