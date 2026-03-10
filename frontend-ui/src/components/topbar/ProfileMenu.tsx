import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Divider, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '../../store/hooks';
import { clearAuth } from '../../store/authSlice';
import { authService } from '../../services/authService';

const StyledAvatar = styled(Avatar)({
  width: 32,
  height: 32,
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  '&:hover': {
    opacity: 0.85,
  },
});


interface ProfileMenuProps {
  initial: string;
}

const ProfileMenu = ({ initial }: ProfileMenuProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNavigate = (path: string) => {
    handleClose();
    navigate(path);
  };

  const handleSignOut = async () => {
    handleClose();
    try {
      await authService.logout();
    } catch {
      // proceed even on backend failure
    } finally {
      dispatch(clearAuth());
      navigate('/login', { replace: true });
    }
  };

  return (
    <>
      <Tooltip title={t('topbar.profile')}>
        <StyledAvatar
          onClick={handleOpen}
          aria-label={t('topbar.profile')}
          aria-controls={open ? 'profile-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
        >
          {initial}
        </StyledAvatar>
      </Tooltip>

      <Menu
        id="profile-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        MenuListProps={{ sx: { p: 0.75 } }}
        slotProps={{
          paper: {
            elevation: 4,
            sx: {
              mt: 1,
              minWidth: 200,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                display: 'block',
                position: 'absolute',
                top: -6,
                right: 14,
                width: 12,
                height: 12,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderBottom: 'none',
                borderRight: 'none',
                transform: 'rotate(45deg)',
                zIndex: 10,
              },
            },
          },
        }}
      >
        <MenuItem onClick={() => handleNavigate('/settings/profile')} sx={{ gap: 1.5, py: 1.25, borderRadius: 1 }}>
          <ListItemIcon sx={{ minWidth: 0, color: 'text.secondary' }}>
            <PersonOutlineIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <Typography variant="body2">{t('topbar.menu.profile')}</Typography>
        </MenuItem>

        <MenuItem onClick={() => handleNavigate('/settings/billing')} sx={{ gap: 1.5, py: 1.25, borderRadius: 1 }}>
          <ListItemIcon sx={{ minWidth: 0, color: 'text.secondary' }}>
            <ReceiptLongOutlinedIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <Typography variant="body2">{t('topbar.menu.billing')}</Typography>
        </MenuItem>

        <MenuItem onClick={() => handleNavigate('/settings/workspace')} sx={{ gap: 1.5, py: 1.25, borderRadius: 1 }}>
          <ListItemIcon sx={{ minWidth: 0, color: 'text.secondary' }}>
            <GroupsOutlinedIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <Typography variant="body2">{t('topbar.menu.workspace')}</Typography>
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem onClick={handleSignOut} sx={{ gap: 1.5, py: 1.25, borderRadius: 1, color: 'error.main' }}>
          <ListItemIcon sx={{ minWidth: 0, color: 'error.main' }}>
            <LogoutIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <Typography variant="body2" color="error.main">{t('topbar.menu.signOut')}</Typography>
        </MenuItem>
      </Menu>
    </>
  );
};

export default ProfileMenu;
