import { Tooltip } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useSearchHealth } from './hooks/useSearchHealth';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

interface DotProps {
  $color: 'success' | 'error' | 'warning';
}

const Dot = styled('span', {
  shouldForwardProp: (p) => p !== '$color',
})<DotProps>(({ theme, $color }) => ({
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor:
    $color === 'success'
      ? theme.vars.palette.success.main
      : $color === 'warning'
        ? theme.vars.palette.warning.main
        : theme.vars.palette.error.main,
  animation: $color !== 'success' ? `${pulse} 1.5s ease-in-out infinite` : 'none',
  flexShrink: 0,
}));

const HealthStatusDot = () => {
  const { t } = useTranslation();
  const { statusColor, vaneOnline, crawl4aiOnline, isLoading } = useSearchHealth();

  if (isLoading) return null;

  const tooltip = t('search.health.tooltip', {
    vane: vaneOnline ? t('search.health.online') : t('search.health.offline'),
    crawl4ai: crawl4aiOnline ? t('search.health.online') : t('search.health.offline'),
  });

  return (
    <Tooltip title={tooltip} placement="bottom" arrow>
      <Dot $color={statusColor} aria-label={tooltip} role="status" />
    </Tooltip>
  );
};

export default HealthStatusDot;
