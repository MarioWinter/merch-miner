import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar, Avatar, Box, Divider, IconButton, ListItemIcon, Menu, MenuItem, Toolbar, Tooltip, Typography } from '@mui/material';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import DiamondOutlinedIcon from '@mui/icons-material/DiamondOutlined';
import CheckIcon from '@mui/icons-material/Check';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { alpha, useColorScheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearAuth } from '../store/authSlice';
import { authService } from '../services/authService';
import { COLORS } from '../style/constants';

const ICON_BUTTON_SX = {
  width: 32,
  height: 32,
  borderRadius: '8px',
  color: 'text.secondary',
  '&:hover': {
    bgcolor: 'action.hover',
    color: 'text.primary',
  },
} as const;

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it'] as const;

function LanguageMenu() {
  const { i18n, t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  function handleOpen(event: React.MouseEvent<HTMLElement>) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleSelect(code: string) {
    i18n.changeLanguage(code);
    handleClose();
  }

  const label = t('topbar.language');

  return (
    <>
      <Tooltip title={label}>
        <IconButton
          onClick={handleOpen}
          size="small"
          aria-label={label}
          aria-controls={open ? 'language-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          sx={ICON_BUTTON_SX}
        >
          <TranslateOutlinedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {LANGUAGES.map((code) => (
          <MenuItem
            key={code}
            onClick={() => handleSelect(code)}
            selected={i18n.language === code}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              {i18n.language === code && <CheckIcon sx={{ fontSize: 18 }} />}
            </ListItemIcon>
            {t(`topbar.languages.${code}`)}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function ColorModeToggle() {
  const { mode, setMode } = useColorScheme();
  const { t } = useTranslation();

  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  function toggleMode() {
    setMode(isDark ? 'light' : 'dark');
  }

  const Icon = isDark ? DarkModeOutlinedIcon : LightModeOutlinedIcon;
  const label = isDark ? t('topbar.darkMode') : t('topbar.lightMode');

  return (
    <Tooltip title={label}>
      <IconButton
        onClick={toggleMode}
        size="small"
        aria-label={label}
        sx={ICON_BUTTON_SX}
      >
        <Icon sx={{ fontSize: 20 }} />
      </IconButton>
    </Tooltip>
  );
}

interface ProfileMenuProps {
  initial: string;
}

function ProfileMenu({ initial }: ProfileMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  function handleOpen(event: React.MouseEvent<HTMLElement>) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleNavigate(path: string) {
    handleClose();
    navigate(path);
  }

  async function handleSignOut() {
    handleClose();
    try {
      await authService.logout();
    } catch {
      // proceed even on backend failure
    } finally {
      dispatch(clearAuth());
      navigate('/login', { replace: true });
    }
  }

  return (
    <>
      <Tooltip title={t('topbar.profile')}>
        <Avatar
          onClick={handleOpen}
          aria-label={t('topbar.profile')}
          aria-controls={open ? 'profile-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          sx={{
            width: 32,
            height: 32,
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            '&:hover': { opacity: 0.85 },
          }}
        >
          {initial}
        </Avatar>
      </Tooltip>

      <Menu
        id="profile-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            elevation: 4,
            sx: {
              mt: 1,
              minWidth: 200,
              borderRadius: '12px',
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'visible',
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
                zIndex: 0,
              },
            },
          },
        }}
      >
        <MenuItem onClick={() => handleNavigate('/settings/profile')} sx={{ gap: 1.5, py: 1.25 }}>
          <ListItemIcon sx={{ minWidth: 0, color: 'text.secondary' }}>
            <PersonOutlineIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <Typography variant="body2">{t('topbar.menu.profile')}</Typography>
        </MenuItem>

        <MenuItem onClick={() => handleNavigate('/settings/billing')} sx={{ gap: 1.5, py: 1.25 }}>
          <ListItemIcon sx={{ minWidth: 0, color: 'text.secondary' }}>
            <ReceiptLongOutlinedIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <Typography variant="body2">{t('topbar.menu.billing')}</Typography>
        </MenuItem>

        <MenuItem onClick={() => handleNavigate('/settings/workspace')} sx={{ gap: 1.5, py: 1.25 }}>
          <ListItemIcon sx={{ minWidth: 0, color: 'text.secondary' }}>
            <GroupsOutlinedIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <Typography variant="body2">{t('topbar.menu.workspace')}</Typography>
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem onClick={handleSignOut} sx={{ gap: 1.5, py: 1.25, color: 'error.main' }}>
          <ListItemIcon sx={{ minWidth: 0, color: 'error.main' }}>
            <LogoutIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <Typography variant="body2" color="error.main">{t('topbar.menu.signOut')}</Typography>
        </MenuItem>
      </Menu>
    </>
  );
}

export default function Topbar() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const initial = user?.email?.[0]?.toUpperCase() || '?';

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={(theme) => ({
        height: 56,
        zIndex: theme.zIndex.drawer + 1,
        bgcolor: alpha(COLORS.white, 0.85),
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        left: 0,
        right: 0,
        ...theme.applyStyles('dark', {
          bgcolor: alpha(COLORS.inkPaper, 0.75),
        }),
      })}
    >
      <Toolbar
        disableGutters
        sx={{
          height: 56,
          minHeight: '56px !important',
          px: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {/* Logo */}
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <DiamondOutlinedIcon sx={{ fontSize: 24, color: 'primary.main' }} />
          <Typography
            variant="h5"
            noWrap
            sx={{
              fontWeight: 700,
              color: 'text.primary',
            }}
          >
            {t('app.name')}
          </Typography>
        </Box>

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Right actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LanguageMenu />
          <ColorModeToggle />

          <ProfileMenu initial={initial} />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
