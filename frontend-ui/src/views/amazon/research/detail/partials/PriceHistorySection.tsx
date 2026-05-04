import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { LineChart } from '@mui/x-charts/LineChart';
import { useTranslation } from 'react-i18next';
import type { PriceSnapshot } from '../../types';

interface PriceHistorySectionProps {
  snapshots: PriceSnapshot[];
}

const ChartContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(2.5),
}));

const PriceHistorySection = ({ snapshots }: PriceHistorySectionProps) => {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return null;
    const sorted = [...snapshots].sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
    return {
      xAxis: sorted.map((s) => new Date(s.recorded_at)),
      series: sorted.map((s) => s.price),
    };
  }, [snapshots]);

  return (
    <ChartContainer>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {t('amazonResearch.detail.priceHistory')}
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
          yAxis={[
            {
              valueFormatter: (val: number) => `$${val.toFixed(2)}`,
            },
          ]}
          series={[
            {
              data: chartData.series,
              color: 'var(--mui-palette-primary-main)',
              area: true,
              showMark: false,
            },
          ]}
          height={250}
          margin={{ left: 60, right: 20, top: 20, bottom: 40 }}
          grid={{ horizontal: true }}
          hideLegend
        />
      ) : (
        <Box
          sx={{
            height: 250,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body2" color="text.disabled">
            {t('amazonResearch.detail.noPriceData')}
          </Typography>
        </Box>
      )}
    </ChartContainer>
  );
};

export default PriceHistorySection;
