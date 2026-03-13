import { Box, IconButton, Typography } from '@mui/material';
import { alpha } from '@mui/material';
import { styled } from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import DiamondOutlinedIcon from '@mui/icons-material/DiamondOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../store/hooks';
import LanguageMenu from './LanguageMenu';
import ColorModeToggle from './ColorModeToggle';
import ProfileMenu from './ProfileMenu';
import WorkspaceSelector from './WorkspaceSelector';
import { COLORS, DURATION, EASING } from '@/style/constants';

const TopbarRoot = styled(AppBar)(({ theme }) => ({
  height: 56,
  zIndex: theme.zIndex.drawer + 1,
  backgroundColor: alpha(COLORS.white, 0.85),
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
    backgroundColor: theme.vars.palette.divider,
    transition: `left ${DURATION.default}ms ${EASING.standard}`,
  },
  ...theme.applyStyles('dark', {
    backgroundColor: alpha(COLORS.inkPaper, 0.75),
  }),
}));

const TopbarIconButton = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: '8px',
  color: theme.vars.palette.text.secondary,
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
    color: theme.vars.palette.text.primary,
  },
}));

const TopbarToolbar = styled(Toolbar)({
  height: 56,
  minHeight: '56px !important',
  paddingLeft: 24,
  paddingRight: 24,
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
});

const Topbar = () => {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const initial =
    user?.first_name?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    '?';
  const avatarUrl = user?.avatar_url ?? null;

  return (
    <TopbarRoot position="fixed" elevation={0}>
      <TopbarToolbar disableGutters>
        {/* Logo */}
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DiamondOutlinedIcon sx={{ fontSize: 24, color: 'primary.main' }} />
          <Typography variant="h5" noWrap sx={{ fontWeight: 700, color: 'text.primary' }}>
            {t('app.name')}
          </Typography>
        </Box>

        {/* WorkspaceSelector — absolutely centered */}
        <Box sx={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <WorkspaceSelector />
        </Box>

        {/* Spacer pushes right actions to the end */}
        <Box sx={{ flex: 1 }} />

        {/* Right actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LanguageMenu />
          <ColorModeToggle />
          <TopbarIconButton
            aria-label={t('topbar.alerts')}
            size="small"
          >
            <NotificationsOutlinedIcon sx={{ fontSize: 20 }} />
          </TopbarIconButton>
          <ProfileMenu initial={initial} avatarUrl={avatarUrl} />
        </Box>
      </TopbarToolbar>
    </TopbarRoot>
  );
};

export default Topbar;
