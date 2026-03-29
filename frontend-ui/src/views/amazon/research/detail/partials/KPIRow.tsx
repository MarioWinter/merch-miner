import { Grid, Stack, Typography, Box } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import StarIcon from '@mui/icons-material/Star';
import ReviewsIcon from '@mui/icons-material/Reviews';
import { useTranslation } from 'react-i18next';
import type { BSRSummary } from '../../types';

interface KPIRowProps {
  bsr: number | null;
  price: number | null;
  reviewsCount: number | null;
  rating: number | null;
  bsrSummary: BSRSummary | null;
}

const KPICard = styled(Box)(({ theme }) => ({
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(2.5),
  minWidth: 160,
}));

const IconBox = styled(Box)(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: alpha(theme.palette.primary.main, 0.12),
}));

const getTrendIcon = (trend: string | undefined) => {
  if (trend === 'up')
    return <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />;
  if (trend === 'down')
    return <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />;
  return <TrendingFlatIcon sx={{ fontSize: 16, color: 'text.secondary' }} />;
};

const getBsrColor = (bsr: number | null) => {
  if (bsr === null) return 'text.secondary';
  if (bsr < 10000) return 'success.main';
  if (bsr <= 50000) return 'warning.main';
  return 'text.secondary';
};

const KPIRow = ({ bsr, price, reviewsCount, rating, bsrSummary }: KPIRowProps) => {
  const { t } = useTranslation();

  const trendLabels: Record<string, string> = {
    up: t('amazonResearch.detail.trendUp', 'Improving'),
    down: t('amazonResearch.detail.trendDown', 'Declining'),
    stable: t('amazonResearch.detail.trendStable', 'Stable'),
  };

  const kpis = [
    {
      label: t('amazonResearch.detail.kpiBsr', 'BSR'),
      value: bsr !== null ? bsr.toLocaleString() : '-',
      icon: (
        <TrendingUpIcon
          sx={{ fontSize: 20, color: 'primary.main' }}
        />
      ),
      trend: bsrSummary?.current_trend,
      color: getBsrColor(bsr),
    },
    {
      label: t('amazonResearch.detail.kpiPrice', 'PRICE'),
      value: price !== null ? `$${Number(price).toFixed(2)}` : '-',
      icon: (
        <AttachMoneyIcon
          sx={{ fontSize: 20, color: 'primary.main' }}
        />
      ),
    },
    {
      label: t('amazonResearch.detail.kpiReviews', 'REVIEWS'),
      value: reviewsCount !== null ? reviewsCount.toLocaleString() : '-',
      icon: (
        <ReviewsIcon
          sx={{ fontSize: 20, color: 'primary.main' }}
        />
      ),
    },
    {
      label: t('amazonResearch.detail.kpiRating', 'RATING'),
      value: rating !== null ? Number(rating).toFixed(1) : '-',
      icon: (
        <StarIcon
          sx={{ fontSize: 20, color: 'primary.main' }}
        />
      ),
    },
  ];

  return (
    <Grid container spacing={2}>
      {kpis.map((kpi) => (
        <Grid key={kpi.label} size={{ xs: 6, sm: 3 }}>
          <KPICard>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Typography
                variant="overline"
                sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}
              >
                {kpi.label}
              </Typography>
              <IconBox>{kpi.icon}</IconBox>
            </Stack>
            <Typography
              variant="h3"
              sx={{ mt: 1, color: kpi.color ?? 'text.primary', fontWeight: 700 }}
            >
              {kpi.value}
            </Typography>
            {kpi.trend && (
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                {getTrendIcon(kpi.trend)}
                <Typography variant="caption" color="text.secondary">
                  {trendLabels[kpi.trend] ?? trendLabels.stable}
                </Typography>
              </Stack>
            )}
          </KPICard>
        </Grid>
      ))}
    </Grid>
  );
};

export default KPIRow;
