import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useGetQuotaQuery } from '@/store/upscaleApi';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const QuotaText = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'severity',
})<{ severity: 'normal' | 'warning' | 'error' }>(({ theme, severity }) => ({
  fontSize: 12,
  lineHeight: 1.4,
  ...(severity === 'normal' && { color: theme.vars.palette.text.secondary }),
  ...(severity === 'warning' && { color: theme.vars.palette.warning.main }),
  ...(severity === 'error' && { color: theme.vars.palette.error.main }),
}));

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const UpscaleQuotaIndicator = () => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useGetQuotaQuery();

  // Hide while loading / on error / for staff (unlimited).
  if (isLoading || isError || !data) return null;
  if (data.is_unlimited || data.limit === null) return null;

  const used = data.used;
  const limit = data.limit;
  const remaining = Math.max(0, limit - used);
  const ratio = limit > 0 ? used / limit : 0;

  let severity: 'normal' | 'warning' | 'error' = 'normal';
  if (ratio >= 1) severity = 'error';
  else if (ratio >= 0.8) severity = 'warning';

  return (
    <QuotaText variant="caption" severity={severity}>
      {t('upscale.quota.inline', {
        defaultValue: 'Quota: {{remaining}}/{{limit}} left this month',
        remaining,
        limit,
      })}
    </QuotaText>
  );
};

export default UpscaleQuotaIndicator;
