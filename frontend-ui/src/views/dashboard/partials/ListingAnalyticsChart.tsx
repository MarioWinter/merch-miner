import { useMemo } from 'react';
import { Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../../style/constants';
import CSVExportButton from './CSVExportButton';
import type { ListingAnalyticsItem } from '../types';

interface ListingAnalyticsChartProps {
  data: ListingAnalyticsItem[];
  isLoading: boolean;
  onExport: () => Promise<void>;
}

const ListingAnalyticsChart = ({ data, isLoading, onExport }: ListingAnalyticsChartProps) => {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    if (!data.length) return null;
    const sorted = [...data].sort((a, b) => a.week.localeCompare(b.week));
    return {
      xLabels: sorted.map((d) => d.week.slice(5)),
      ready: sorted.map((d) => d.listings_ready),
      published: sorted.map((d) => d.listings_published),
    };
  }, [data]);

  return (
    <Card elevation={0}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">
            {t('dashboard.analytics.listingsTitle')}
          </Typography>
          <CSVExportButton onExport={onExport} />
        </Stack>
        {isLoading ? (
          <Skeleton variant="rounded" height={280} />
        ) : !chartData ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {t('dashboard.analytics.noData')}
          </Typography>
        ) : (
          <LineChart
            height={280}
            xAxis={[{
              data: chartData.xLabels,
              scaleType: 'band',
              label: t('dashboard.analytics.weekLabel'),
            }]}
            series={[
              {
                data: chartData.ready,
                label: t('dashboard.analytics.listingsReady'),
                color: COLORS.successDk,
              },
              {
                data: chartData.published,
                label: t('dashboard.analytics.listingsPublished'),
                color: COLORS.cyan,
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default ListingAnalyticsChart;
