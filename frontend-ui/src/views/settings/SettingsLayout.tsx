import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import { useTranslation } from 'react-i18next';
import { alpha } from '@mui/material/styles';
import { COLORS, DURATION, EASING } from '../../style/constants';

interface SettingsNavItem {
  labelKey: string;
  path: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: SettingsNavItem[] = [
  {
    labelKey: 'settings.nav.profile',
    path: '/settings/profile',
    icon: <PersonOutlineIcon sx={{ fontSize: 20 }} />,
  },
  {
    labelKey: 'settings.nav.billing',
    path: '/settings/billing',
    icon: <ReceiptLongOutlinedIcon sx={{ fontSize: 20 }} />,
  },
  {
    labelKey: 'settings.nav.workspace',
    path: '/settings/workspace',
    icon: <GroupsOutlinedIcon sx={{ fontSize: 20 }} />,
  },
];

// NavLink is used just for active matching; the actual navigation goes through ListItemButton onClick
// to keep MUI styling consistent.

export default function SettingsLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  }

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 3,
        alignItems: 'flex-start',
        maxWidth: 1100,
        mx: 'auto',
      }}
    >
      {/* Left nav panel */}
      <Box
        component="aside"
        aria-label={t('settings.nav.label')}
        sx={{
          width: 200,
          flexShrink: 0,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '12px',
          p: 1,
          position: 'sticky',
          top: 80, // topbar 56 + 24 gap
        }}
      >
        <Typography
          variant="overline"
          sx={{
            display: 'block',
            px: 2,
            pt: 1,
            pb: 0.5,
            color: 'text.disabled',
            userSelect: 'none',
          }}
        >
          {t('settings.title')}
        </Typography>

        <List disablePadding>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <ListItemButton
                key={item.path}
                component={NavLink}
                to={item.path}
                onClick={() => navigate(item.path)}
                aria-current={active ? 'page' : undefined}
                sx={{
                  height: 40,
                  px: 2,
                  borderRadius: '8px',
                  mb: '2px',
                  gap: 1.5,
                  bgcolor: active ? alpha(COLORS.red, 0.12) : 'transparent',
                  color: active ? 'primary.main' : 'text.secondary',
                  borderLeft: '2px solid',
                  borderColor: active ? 'primary.main' : 'transparent',
                  '&:hover': {
                    bgcolor: active ? 'rgba(255,90,79,0.12)' : 'action.hover',
                    color: active ? 'primary.main' : 'text.primary',
                  },
                  transition: `background-color ${DURATION.fast}ms ${EASING.standard}, color ${DURATION.fast}ms ${EASING.standard}`,
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, color: 'inherit' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={t(item.labelKey)}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      {/* Right content panel */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
