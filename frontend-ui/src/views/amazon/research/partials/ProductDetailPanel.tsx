import { useState } from 'react';
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import { LineChart } from '@mui/x-charts/LineChart';
import { useSnackbar } from 'notistack';
import { useGetBSRHistoryQuery } from '../../../../store/researchSlice';
import { useCreateNicheMutation } from '../../../../store/nicheSlice';
import { MARKETPLACE_OPTIONS, type AmazonProduct } from '../types';

interface ProductDetailPanelProps {
  product: AmazonProduct;
  keyword: string;
}

const PanelBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.vars.palette.background.paper,
  borderRadius: 12,
  border: `1px solid ${alpha('#fff', 0.08)}`,
  padding: theme.spacing(3),
  marginTop: theme.spacing(1),
  ...theme.applyStyles('light', {
    border: `1px solid ${alpha('#071E26', 0.08)}`,
  }),
}));

const DescriptionText = styled(Typography)<{ expanded: boolean }>(
  ({ expanded }) => ({
    ...(!expanded && {
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    }),
  }),
);

const ProductDetailPanel = ({ product, keyword }: ProductDetailPanelProps) => {
  const [descExpanded, setDescExpanded] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const { data: bsrHistory, isLoading: bsrLoading } = useGetBSRHistoryQuery({
    asin: product.asin,
    marketplace: product.marketplace,
  });

  const [createNiche, { isLoading: creating }] = useCreateNicheMutation();

  const handleAddToNiche = async () => {
    try {
      await createNiche({ name: keyword }).unwrap();
      enqueueSnackbar('Added to niche list', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to add niche', { variant: 'error' });
    }
  };

  const mp = MARKETPLACE_OPTIONS.find((m) => m.value === product.marketplace);
  const amazonSearchUrl = `https://www.${mp?.domain ?? 'amazon.com'}/s?k=${encodeURIComponent(keyword)}`;

  const hasChart = bsrHistory && bsrHistory.length >= 2;
  const chartDates = bsrHistory?.map((s) => new Date(s.recorded_at)) ?? [];
  const chartBsr = bsrHistory?.map((s) => s.bsr) ?? [];

  return (
    <PanelBox>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        {/* BSR History Chart */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            BSR History (30 days)
          </Typography>
          {bsrLoading ? (
            <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2 }} />
          ) : hasChart ? (
            <LineChart
              xAxis={[
                {
                  data: chartDates,
                  scaleType: 'time',
                  tickLabelStyle: { fontSize: 10 },
                },
              ]}
              yAxis={[{ reverse: true }]}
              series={[{ data: chartBsr, label: 'BSR', color: '#00C8D7' }]}
              height={180}
              margin={{ top: 10, right: 10, bottom: 30, left: 50 }}
              slotProps={{ legend: { sx: { display: 'none' } } }}
            />
          ) : (
            <Box
              sx={{
                height: 180,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="body2" color="text.disabled">
                Not enough history yet
              </Typography>
            </Box>
          )}
        </Box>

        {/* Bullets + Description */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {(product.bullet_1 || product.bullet_2) && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Features
              </Typography>
              <List dense disablePadding>
                {product.bullet_1 && (
                  <ListItem disableGutters sx={{ py: 0.25 }}>
                    <ListItemText
                      primary={product.bullet_1}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                )}
                {product.bullet_2 && (
                  <ListItem disableGutters sx={{ py: 0.25 }}>
                    <ListItemText
                      primary={product.bullet_2}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                )}
              </List>
            </>
          )}

          {product.description && (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Description
              </Typography>
              <DescriptionText variant="body2" expanded={descExpanded}>
                {product.description}
              </DescriptionText>
              <Button
                size="small"
                variant="text"
                onClick={() => setDescExpanded(!descExpanded)}
                sx={{ mt: 0.5, p: 0, minWidth: 0, color: 'text.secondary' }}
              >
                {descExpanded ? 'Show less' : 'Show more'}
              </Button>
            </Box>
          )}

          <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddToNiche}
              disabled={creating}
              aria-label="Add to niche list"
            >
              Add to Niche List
            </Button>
            <Button
              variant="outlined"
              size="small"
              endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              component="a"
              href={amazonSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open on Amazon"
            >
              Open on Amazon
            </Button>
          </Stack>
        </Box>
      </Stack>
    </PanelBox>
  );
};

export default ProductDetailPanel;
