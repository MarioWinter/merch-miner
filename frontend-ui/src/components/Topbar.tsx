import { useNavigate } from 'react-router-dom';
import { AppBar, Avatar, Box, IconButton, Toolbar, Tooltip, Typography } from '@mui/material';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import DiamondOutlinedIcon from '@mui/icons-material/DiamondOutlined';
import { alpha, useColorScheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store/hooks';
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

function LanguageToggle() {
  const { i18n, t } = useTranslation();

  function toggleLanguage() {
    const next = i18n.language === 'en' ? 'de' : 'en';
    i18n.changeLanguage(next);
  }

  const label = `${t('topbar.switchLanguage')} (${i18n.language === 'en' ? 'DE' : 'EN'})`;

  return (
    <Tooltip title={label}>
      <IconButton
        onClick={toggleLanguage}
        size="small"
        aria-label={label}
        sx={ICON_BUTTON_SX}
      >
        <TranslateOutlinedIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </Tooltip>
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

export default function Topbar() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);

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
          <LanguageToggle />
          <ColorModeToggle />

          <Tooltip title={t('topbar.profile')}>
            <Avatar
              onClick={() => navigate('/settings/profile')}
              sx={{
                width: 32,
                height: 32,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                '&:hover': { opacity: 0.85 },
              }}
            >
              {user?.email?.[0]?.toUpperCase() || '?'}
            </Avatar>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
