import { Tab, Tabs } from '@mui/material';
import { styled } from '@mui/material/styles';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import { useTranslation } from 'react-i18next';
import type { DrawerPanel } from '@/types/search';

interface DrawerSegmentsProps {
  activePanel: DrawerPanel;
  onChange: (panel: DrawerPanel) => void;
}

const SegmentTabs = styled(Tabs)(({ theme }) => ({
  minHeight: 36,
  '& .MuiTab-root': {
    textTransform: 'none',
    fontSize: '0.8125rem',
    fontWeight: 500,
    minHeight: 36,
    minWidth: 0,
    padding: `${theme.spacing(0.5)} ${theme.spacing(1.5)}`,
    color: theme.vars.palette.text.secondary,
    '&.Mui-selected': {
      color: theme.vars.palette.primary.main,
    },
  },
  '& .MuiTab-iconWrapper': {
    marginRight: theme.spacing(0.75),
    marginBottom: 0,
  },
  '& .MuiTabs-indicator': {
    height: 2,
    backgroundColor: theme.vars.palette.primary.main,
  },
}));

const DrawerSegments = ({ activePanel, onChange }: DrawerSegmentsProps) => {
  const { t } = useTranslation();

  return (
    <SegmentTabs
      value={activePanel}
      onChange={(_, value: DrawerPanel) => onChange(value)}
      aria-label={t('search.drawer.segments')}
    >
      <Tab
        value="niche"
        icon={<CategoryOutlinedIcon sx={{ fontSize: 18 }} />}
        iconPosition="start"
        label={t('search.drawer.nicheDetail')}
        aria-label={t('search.drawer.nicheDetail')}
      />
      <Tab
        value="chat"
        icon={<ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />}
        iconPosition="start"
        label={t('search.drawer.chat')}
        aria-label={t('search.drawer.chat')}
      />
      <Tab
        value="agent"
        icon={<SmartToyOutlinedIcon sx={{ fontSize: 18 }} />}
        iconPosition="start"
        label={t('agent.tab.label')}
        aria-label={t('agent.tab.label')}
      />
    </SegmentTabs>
  );
};

export default DrawerSegments;
