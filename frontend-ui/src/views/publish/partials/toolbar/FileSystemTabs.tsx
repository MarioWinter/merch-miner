import { Box, Typography } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { FileSystemTab } from '../../types';

interface FileSystemTabsProps {
  activeTab: FileSystemTab;
  onTabChange: (tab: FileSystemTab) => void;
  cloudConnected?: boolean;
}

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const TabsContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
  gap: 0,
});

const Tab = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isActive',
})<{ isActive: boolean }>(({ theme, isActive }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2.5),
  cursor: 'pointer',
  position: 'relative',
  userSelect: 'none',
  transition: `color ${DURATION.fast}ms ${EASING.standard}`,
  color: isActive ? theme.vars.palette.secondary.main : theme.vars.palette.text.secondary,
  '&:hover': {
    color: isActive ? theme.vars.palette.secondary.main : theme.vars.palette.text.primary,
  },
}));

const Underline = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'activeIndex',
})<{ activeIndex: number }>(({ activeIndex }) => ({
  position: 'absolute',
  bottom: 0,
  height: 2,
  backgroundColor: COLORS.cyan,
  transition: `left ${DURATION.fast}ms ${EASING.standard}, width ${DURATION.fast}ms ${EASING.standard}`,
  // Positioned dynamically via style prop
  left: activeIndex === 0 ? 0 : '50%',
  width: '50%',
}));

const ConnectionDot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'connected',
})<{ connected: boolean }>(({ connected }) => ({
  position: 'absolute',
  top: 2,
  right: 4,
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: connected ? COLORS.successDk : COLORS.warningDk,
  ...(!connected && {
    animation: `${pulse} 2s ease-in-out infinite`,
  }),
}));

const FileSystemTabs = ({ activeTab, onTabChange, cloudConnected = false }: FileSystemTabsProps) => {
  const { t } = useTranslation();

  return (
    <TabsContainer>
      <Tab
        isActive={activeTab === 'my_designs'}
        onClick={() => onTabChange('my_designs')}
        role="tab"
        aria-selected={activeTab === 'my_designs'}
      >
        <FolderOutlinedIcon sx={{ fontSize: 18 }} />
        <Typography variant="subtitle2">
          {t('publish.tabs.myDesigns', { defaultValue: 'My Designs' })}
        </Typography>
      </Tab>
      <Tab
        isActive={activeTab === 'cloud_storage'}
        onClick={() => onTabChange('cloud_storage')}
        role="tab"
        aria-selected={activeTab === 'cloud_storage'}
        sx={{ position: 'relative' }}
      >
        <CloudOutlinedIcon sx={{ fontSize: 18 }} />
        <Typography variant="subtitle2">
          {t('publish.tabs.cloudStorage', { defaultValue: 'Cloud Storage' })}
        </Typography>
        <ConnectionDot connected={cloudConnected} />
      </Tab>
      <Underline activeIndex={activeTab === 'my_designs' ? 0 : 1} />
    </TabsContainer>
  );
};

export default FileSystemTabs;
