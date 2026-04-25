import { ToggleButton, ToggleButtonGroup, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import { useTranslation } from 'react-i18next';
import type { DrawerPanel } from '@/types/search';
import HealthStatusDot from './HealthStatusDot';

interface DrawerSegmentsProps {
  activePanel: DrawerPanel;
  onChange: (panel: DrawerPanel) => void;
}

const SegmentGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButton-root': {
    textTransform: 'none',
    fontSize: '0.8125rem',
    fontWeight: 500,
    padding: `${theme.spacing(0.5)} ${theme.spacing(1.5)}`,
    gap: theme.spacing(0.5),
    border: 'none',
    borderRadius: `${theme.shape.borderRadius}px !important`,
    color: theme.vars.palette.text.secondary,
    '&.Mui-selected': {
      color: theme.vars.palette.primary.main,
      backgroundColor: `rgba(255, 90, 79, 0.12)`,
    },
  },
}));

const DrawerSegments = ({ activePanel, onChange }: DrawerSegmentsProps) => {
  const { t } = useTranslation();

  const handleChange = (_: React.MouseEvent<HTMLElement>, value: DrawerPanel | null) => {
    if (value) onChange(value);
  };

  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <SegmentGroup
        value={activePanel}
        exclusive
        onChange={handleChange}
        size="small"
        aria-label={t('search.drawer.segments')}
      >
        <ToggleButton value="niche" aria-label={t('search.drawer.nicheDetail')}>
          <InfoOutlinedIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2" component="span">
            {t('search.drawer.nicheDetail')}
          </Typography>
        </ToggleButton>
        <ToggleButton value="chat" aria-label={t('search.drawer.chat')}>
          <ChatOutlinedIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2" component="span">
            {t('search.drawer.chat')}
          </Typography>
        </ToggleButton>
        <ToggleButton value="agent" aria-label={t('agent.tab.label')}>
          <SmartToyOutlinedIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2" component="span">
            {t('agent.tab.label')}
          </Typography>
        </ToggleButton>
      </SegmentGroup>
      <HealthStatusDot />
    </Stack>
  );
};

export default DrawerSegments;
