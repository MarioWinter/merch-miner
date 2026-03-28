import { useMemo } from 'react';
import { Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../../style/constants';
import CSVExportButton from './CSVExportButton';
import type { DesignAnalyticsItem } from '../types';

const CHART_COLORS = [COLORS.red, COLORS.cyan, COLORS.successDk, COLORS.warningDk, COLORS.infoDk];

interface DesignAnalyticsChartProps {
  data: DesignAnalyticsItem[];
  isLoading: boolean;
  onExport: () => Promise<void>;
}

const DesignAnalyticsChart = ({ data, isLoading, onExport }: DesignAnalyticsChartProps) => {
  const { t } = useTranslation();

  const { weeks, series } = useMemo(() => {
    if (!data.length) return { weeks: [], series: [] };

    const weekSet = [...new Set(data.map((d) => d.week))].sort();
    const models = [...new Set(data.map((d) => d.model_name))];

    const modelSeries = models.map((model, idx) => ({
      label: model,
      data: weekSet.map((w) => {
        const item = data.find((d) => d.week === w && d.model_name === model);
        return item?.count ?? 0;
      }),
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));

    return { weeks: weekSet, series: modelSeries };
  }, [data]);

  return (
    <Card elevation={0}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">
            {t('dashboard.analytics.designsTitle')}
          </Typography>
          <CSVExportButton onExport={onExport} />
        </Stack>
        {isLoading ? (
          <Skeleton variant="rounded" height={280} />
        ) : weeks.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {t('dashboard.analytics.noData')}
          </Typography>
        ) : (
          <BarChart
            height={280}
            xAxis={[{
              data: weeks.map((w) => w.slice(5)),
              scaleType: 'band',
              label: t('dashboard.analytics.weekLabel'),
            }]}
            series={series}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default DesignAnalyticsChart;
