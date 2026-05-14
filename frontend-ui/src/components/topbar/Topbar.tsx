import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material';
import { styled } from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import DiamondOutlinedIcon from '@mui/icons-material/DiamondOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { openDrawer } from '../../store/chatBarSlice';
import LanguageMenu from './LanguageMenu';
import ColorModeToggle from './ColorModeToggle';
import ProfileMenu from './ProfileMenu';
import WorkspaceSelector from './WorkspaceSelector';
import NicheSelector from './NicheSelector';
import NotificationBell from '../NotificationBell';
import HealthStatusDot from '../MultiPurposeDrawer/HealthStatusDot';
import UpscaleStatusPill from '@/views/designs/board/partials/UpscaleStatusPill';
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
  const dispatch = useAppDispatch();
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

        {/* Workspace + Niche chips — absolutely centered as a pair */}
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <WorkspaceSelector />
          <NicheSelector />
        </Box>

        {/* Spacer pushes right actions to the end */}
        <Box sx={{ flex: 1 }} />

        {/* Right actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ px: 1, display: 'flex', alignItems: 'center' }}>
            <HealthStatusDot />
          </Box>
          <Tooltip title={t('topbar.chat.open')}>
            <IconButton
              size="small"
              onClick={() => dispatch(openDrawer('chat'))}
              aria-label={t('topbar.chat.open')}
              data-testid="topbar-open-chat"
            >
              <ChatBubbleOutlineIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
          <LanguageMenu />
          <ColorModeToggle />
          <UpscaleStatusPill />
          <NotificationBell />
          <ProfileMenu initial={initial} avatarUrl={avatarUrl} />
        </Box>
      </TopbarToolbar>
    </TopbarRoot>
  );
};

export default Topbar;
