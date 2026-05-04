import { Chip } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTranslation } from 'react-i18next';
import type { CrawlStatus } from '@/types/search';

interface CrawlStatusBadgeProps {
  status: CrawlStatus;
}

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const statusConfig: Record<CrawlStatus, { color: 'default' | 'info' | 'success' | 'error'; i18nKey: string }> = {
  pending: { color: 'default', i18nKey: 'search.crawl.pending' },
  running: { color: 'info', i18nKey: 'search.crawl.running' },
  completed: { color: 'success', i18nKey: 'search.crawl.completed' },
  failed: { color: 'error', i18nKey: 'search.crawl.failed' },
};

const icons: Record<CrawlStatus, React.ReactElement> = {
  pending: <HourglassEmptyIcon sx={{ fontSize: 14 }} />,
  running: <SyncIcon sx={{ fontSize: 14, animation: `${spin} 1.2s linear infinite` }} />,
  completed: <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />,
  failed: <ErrorOutlineIcon sx={{ fontSize: 14 }} />,
};

const CrawlStatusBadge = ({ status }: CrawlStatusBadgeProps) => {
  const { t } = useTranslation();
  const config = statusConfig[status];

  return (
    <Chip
      icon={icons[status]}
      label={t(config.i18nKey)}
      size="small"
      color={config.color}
      variant="outlined"
      sx={{ fontSize: '0.6875rem', height: 22 }}
    />
  );
};

export default CrawlStatusBadge;
