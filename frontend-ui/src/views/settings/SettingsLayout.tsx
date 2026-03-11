import { NavLink, useLocation } from 'react-router-dom';
import { Box, Tab, Tabs } from '@mui/material';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import { useTranslation } from 'react-i18next';
import React from 'react';
import ProfileSection from './profile/ProfileSection';
import BillingSection from './billing/BillingSection';
import WorkspaceSection from './workspace/WorkspaceSection';

const TABS: { path: string; labelKey: string; icon: React.ReactElement; Component: React.ComponentType }[] = [
  { path: '/settings/profile', labelKey: 'settings.nav.profile', icon: <PersonOutlinedIcon sx={{ fontSize: 18 }} />, Component: ProfileSection },
  { path: '/settings/billing', labelKey: 'settings.nav.billing', icon: <CreditCardOutlinedIcon sx={{ fontSize: 18 }} />, Component: BillingSection },
  { path: '/settings/workspace', labelKey: 'settings.nav.workspace', icon: <GroupsOutlinedIcon sx={{ fontSize: 18 }} />, Component: WorkspaceSection },
];

const SettingsLayout = () => {
  const { t } = useTranslation();
  const location = useLocation();

  const activeTab = TABS.findIndex((tab) =>
    location.pathname.startsWith(tab.path)
  );

  const active = activeTab === -1 ? 0 : activeTab;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* Settings tab nav */}
      <Tabs
        value={active}
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

      {TABS.map((tab, index) => (
        <Box key={tab.path} sx={{ display: index === active ? 'block' : 'none' }}>
          <tab.Component />
        </Box>
      ))}
    </Box>
  );
};

export default SettingsLayout;
