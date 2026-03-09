import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import DiamondOutlinedIcon from '@mui/icons-material/DiamondOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store/hooks';
import LanguageMenu from './topbar/LanguageMenu';
import ColorModeToggle from './topbar/ColorModeToggle';
import ProfileMenu from './topbar/ProfileMenu';
import WorkspaceSelector from './topbar/WorkspaceSelector';
import { TopbarRoot, TopbarToolbar } from './topbar/Topbar.styles';

const Topbar = (): React.JSX.Element => {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);
  const initial = user?.email?.[0]?.toUpperCase() || '?';

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
          <IconButton
            aria-label={t('topbar.alerts')}
            size="small"
            sx={{ width: 36, height: 36 }}
          >
            <NotificationsOutlinedIcon fontSize="small" />
          </IconButton>
          <ProfileMenu initial={initial} />
        </Box>
      </TopbarToolbar>
    </TopbarRoot>
  );
};

export default Topbar;
