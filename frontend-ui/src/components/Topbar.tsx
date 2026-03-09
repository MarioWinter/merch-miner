import { AppBar, Box, IconButton, Toolbar, Typography } from '@mui/material';
import DiamondOutlinedIcon from '@mui/icons-material/DiamondOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store/hooks';
import { COLORS, DURATION, EASING } from '../style/constants';
import LanguageMenu from './topbar/LanguageMenu';
import ColorModeToggle from './topbar/ColorModeToggle';
import ProfileMenu from './topbar/ProfileMenu';
import WorkspaceSelector from './topbar/WorkspaceSelector';

const Topbar = () => {
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
        left: 0,
        right: 0,
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          left: 'var(--sidebar-w, 0px)',
          right: 0,
          height: '1px',
          bgcolor: 'divider',
          transition: `left ${DURATION.default}ms ${EASING.standard}`,
        },
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
          position: 'relative',
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

        {/* WorkspaceSelector — absolutely centered */}
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <WorkspaceSelector />
        </Box>

        {/* Spacer pushes right actions to the end */}
        <Box sx={{ flex: 1 }} />

        {/* Right actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LanguageMenu />
          <ColorModeToggle />
          <IconButton
            aria-label={t('topbar.alerts')}
            size="small"
            sx={{ width: 36, height: 36 }}
          >
            <NotificationsOutlinedIcon fontSize="small" />
          </IconButton>
          <ProfileMenu initial={initial} />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Topbar;
