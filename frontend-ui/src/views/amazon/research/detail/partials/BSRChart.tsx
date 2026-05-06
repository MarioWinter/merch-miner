import { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { MONO_FONT_STACK } from '../../../../../style/constants';
import { LineChart } from '@mui/x-charts/LineChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { useTranslation } from 'react-i18next';
import type { BSRSnapshot, BSRSummary, BSRCategory } from '../../types';

interface BSRChartProps {
  snapshots: BSRSnapshot[];
  summary: BSRSummary | null;
  categories: BSRCategory[] | undefined;
}

const ChartContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(2.5),
}));

const SummaryCard = styled(Box)(({ theme }) => ({
  backgroundColor: theme.vars.palette.background.default,
  borderRadius: 8,
  padding: theme.spacing(1.5, 2),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const trendIcon = (trend: string) => {
  if (trend === 'up')
    return <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />;
  if (trend === 'down')
    return <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />;
  return <TrendingFlatIcon sx={{ fontSize: 16, color: 'text.secondary' }} />;
};

const BSRChart = ({ snapshots, summary, categories }: BSRChartProps) => {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return null;
    const sorted = [...snapshots].sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
    return {
      xAxis: sorted.map((s) => new Date(s.recorded_at)),
      series: sorted.map((s) => s.bsr),
    };
  }, [snapshots]);

  const categoryList = categories ?? [];

  return (
    <Stack spacing={2}>
      <ChartContainer>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          {t('amazonResearch.detail.bsrHistory')}
        </Typography>

        {chartData ? (
          <LineChart
            xAxis={[
              {
                data: chartData.xAxis,
                scaleType: 'time',
                valueFormatter: (date: Date) => date.toLocaleDateString(),
              },
            ]}
            yAxis={[{ reverse: true }]}
            series={[
              {
                data: chartData.series,
                color: 'var(--mui-palette-secondary-main)',
                area: true,
                showMark: false,
              },
            ]}
            height={300}
            margin={{ left: 60, right: 20, top: 20, bottom: 40 }}
            grid={{ horizontal: true }}
            hideLegend
          />
        ) : (
          <Box
            sx={{
              height: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="body2" color="text.disabled">
              {t('amazonResearch.detail.noBsrData')}
            </Typography>
          </Box>
        )}
      </ChartContainer>

      {/* BSR Summary */}
      {summary && (
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <SummaryCard>
            {trendIcon(summary.overall_trend)}
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('amazonResearch.detail.overall')}
              </Typography>
              <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                {summary.overall_trend}
              </Typography>
            </Box>
          </SummaryCard>
          <SummaryCard>
            {trendIcon(summary.current_trend)}
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('amazonResearch.detail.current')}
              </Typography>
              <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                {summary.current_trend}
              </Typography>
            </Box>
          </SummaryCard>
          <SummaryCard>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('amazonResearch.detail.average')}
              </Typography>
              <Typography variant="body2">
                {summary.average?.toLocaleString() ?? '–'}
              </Typography>
            </Box>
          </SummaryCard>
          <SummaryCard>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('amazonResearch.detail.median')}
              </Typography>
              <Typography variant="body2">
                {summary.median?.toLocaleString() ?? '–'}
              </Typography>
            </Box>
          </SummaryCard>
        </Stack>
      )}

      {/* Subcategory Ranks */}
      {categoryList.length > 0 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {t('amazonResearch.detail.subcategoryRanks')}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: 'wrap', gap: 0.5 }}
          >
            {categoryList.filter((item) => item.rank != null).map((item) => {
              const getRankPalette = (rank: number) => {
                if (rank < 10000) return { color: 'success.main', bg: 'success' as const };
                if (rank <= 50000) return { color: 'warning.main', bg: 'warning' as const };
                return { color: 'text.secondary', bg: 'neutral' as const };
              };
              const palette = getRankPalette(item.rank);
              return (
                <Box
                  key={item.category}
                  sx={(theme) => ({
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: '8px',
                    border: `1px solid ${theme.vars.palette.divider}`,
                    overflow: 'hidden',
                  })}
                >
                  <Typography
                    sx={{
                      fontSize: '0.78rem',
                      color: 'text.primary',
                      px: 1.5,
                      py: 0.5,
                    }}
                  >
                    {item.category}
                  </Typography>
                  <Typography
                    sx={(theme) => ({
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      fontFamily: MONO_FONT_STACK,
                      color: palette.color,
                      px: 1.25,
                      py: 0.5,
                      backgroundColor: alpha(
                        palette.bg === 'success' ? theme.palette.success.main
                          : palette.bg === 'warning' ? theme.palette.warning.main
                          : theme.palette.text.secondary,
                        0.12,
                      ),
                      borderLeft: `1px solid ${theme.vars.palette.divider}`,
                    })}
                  >
                    <TrendingUpIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'text-bottom' }} />
                    {item.rank.toLocaleString()}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}
    </Stack>
  );
};

export default BSRChart;
