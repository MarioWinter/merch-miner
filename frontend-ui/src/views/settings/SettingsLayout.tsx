import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Box, Tab, Tabs } from '@mui/material';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import { useTranslation } from 'react-i18next';

const TABS = [
  { path: '/settings/profile', labelKey: 'settings.nav.profile', icon: <PersonOutlinedIcon sx={{ fontSize: 18 }} /> },
  { path: '/settings/billing', labelKey: 'settings.nav.billing', icon: <CreditCardOutlinedIcon sx={{ fontSize: 18 }} /> },
  { path: '/settings/workspace', labelKey: 'settings.nav.workspace', icon: <GroupsOutlinedIcon sx={{ fontSize: 18 }} /> },
];

const SettingsLayout = (): JSX.Element => {
  const { t } = useTranslation();
  const location = useLocation();

  const activeTab = TABS.findIndex((tab) =>
    location.pathname.startsWith(tab.path)
  );

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* Settings tab nav */}
      <Tabs
        value={activeTab === -1 ? 0 : activeTab}
        aria-label={t('settings.nav.label')}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        {TABS.map((tab) => (
          <Tab
            key={tab.path}
            label={t(tab.labelKey)}
            icon={tab.icon}
            iconPosition="start"
            component={NavLink}
            to={tab.path}
            sx={{
              minHeight: 44,
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.875rem',
              gap: 0.75,
            }}
          />
        ))}
      </Tabs>

      {/* Section content */}
      <Outlet />
    </Box>
  );
};

export default SettingsLayout;
