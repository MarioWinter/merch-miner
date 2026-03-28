import { useMemo } from 'react';
import { Card, CardContent, Chip, Skeleton, Stack, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../../style/constants';
import CSVExportButton from './CSVExportButton';
import PlaceholderWidget from './PlaceholderWidget';
import type { SearchActivity } from '../types';

interface SearchActivityWidgetProps {
  data: SearchActivity | null;
  isLoading: boolean;
  onExport: () => Promise<void>;
}

const SearchActivityWidget = ({ data, isLoading, onExport }: SearchActivityWidgetProps) => {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    if (!data?.searches_this_week?.length) return null;
    return {
      days: data.searches_this_week.map((d) => d.day.slice(5)),
      counts: data.searches_this_week.map((d) => d.count),
    };
  }, [data]);

  if (!isLoading && data?.configured === false) {
    return (
      <PlaceholderWidget
        title={t('dashboard.search.title')}
        message={data.message ?? t('dashboard.placeholder.searchNotConfigured')}
      />
    );
  }

  return (
    <Card elevation={0}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">{t('dashboard.search.title')}</Typography>
          <CSVExportButton onExport={onExport} />
        </Stack>

        {isLoading ? (
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={200} />
            <Skeleton variant="rounded" height={24} width="60%" />
          </Stack>
        ) : !data ? (
          <Typography variant="body2" color="text.secondary">
            {t('dashboard.analytics.noData')}
          </Typography>
        ) : (
          <Stack spacing={2}>
            {/* Searches per day bar chart */}
            {chartData ? (
              <BarChart
                height={200}
                xAxis={[{
                  data: chartData.days,
                  scaleType: 'band',
                }]}
                series={[{
                  data: chartData.counts,
                  label: t('dashboard.search.searchesPerDay'),
                  color: COLORS.cyan,
                }]}
              />
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                {t('dashboard.analytics.noData')}
              </Typography>
            )}

            {/* Crawl stats */}
            <Stack direction="row" spacing={3}>
              <Stack>
                <Typography variant="caption" color="text.secondary">
                  {t('dashboard.search.crawlCount')}
                </Typography>
                <Typography variant="h5">{data.crawl_count}</Typography>
              </Stack>
              <Stack>
                <Typography variant="caption" color="text.secondary">
                  {t('dashboard.search.crawlSuccessRate')}
                </Typography>
                <Typography variant="h5">
                  {Math.round((data.crawl_success_rate ?? 0) * 100)}%
                </Typography>
              </Stack>
            </Stack>

            {/* Top queries */}
            {data.top_queries?.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  {t('dashboard.search.topQueries')}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {data.top_queries.map((query) => (
                    <Chip key={query} label={query} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Stack>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default SearchActivityWidget;
