import { Box, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { LineChart } from '@mui/x-charts/LineChart';
import { useTranslation } from 'react-i18next';
import { useLazyGetKeywordHistoryQuery } from '@/store/keywordSlice';
import { useCallback, useEffect } from 'react';
import { COLORS } from '@/style/constants';

interface TrendChartProps {
  keyword: string | null;
  marketplace: string;
  open: boolean;
  onClose: () => void;
}

export const TrendChart = ({ keyword, marketplace, open, onClose }: TrendChartProps) => {
  const { t } = useTranslation();
  const [fetchHistory, { data, isLoading, error }] = useLazyGetKeywordHistoryQuery();

  useEffect(() => {
    if (keyword && open) {
      fetchHistory({ keyword, marketplace });
    }
  }, [keyword, marketplace, open, fetchHistory]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  const hasData = data && data.length > 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="span">
          {t('keywords.trend.chartTitle')}: {keyword}
        </Typography>
        <IconButton size="small" onClick={handleClose} aria-label="Close">
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {!!error && (
          <Typography color="error" sx={{ py: 4, textAlign: 'center' }}>
            {t('keywords.errors.historyFailed')}
          </Typography>
        )}

        {!isLoading && !error && !hasData && (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {t('keywords.trend.noData')}
          </Typography>
        )}

        {!isLoading && hasData && (
          <LineChart
            xAxis={[{
              data: data.map((p) => p.month),
              scaleType: 'band',
              label: t('keywords.trend.monthLabel'),
            }]}
            series={[{
              data: data.map((p) => p.search_volume),
              label: t('keywords.trend.volumeLabel'),
              color: COLORS.cyan,
              area: true,
            }]}
            height={300}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
