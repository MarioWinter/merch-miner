import { Box, Typography, Chip, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import { useTranslation } from 'react-i18next';
import { useGetLifecycleQuery } from '@/store/publishSlice';
import { MONO_FONT_STACK } from '@/style/constants';

const ChainRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 0),
  flexWrap: 'wrap',
}));

const StepChip = styled(Chip)({
  '& .MuiChip-icon': { fontSize: 16 },
});

interface LifecycleChainProps {
  nicheId: string | null;
}

const LifecycleChain = ({ nicheId }: LifecycleChainProps) => {
  const { t } = useTranslation();
  const { data, isLoading } = useGetLifecycleQuery(nicheId ?? '', {
    skip: !nicheId,
  });

  if (!nicheId) return null;

  if (isLoading) {
    return (
      <Box component="section" aria-label={t('publish.lifecycle.title')}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          {t('publish.lifecycle.title')}
        </Typography>
        <Skeleton variant="rounded" height={40} />
      </Box>
    );
  }

  if (!data || Object.keys(data.rounds).length === 0) {
    return (
      <Box component="section" aria-label={t('publish.lifecycle.title')}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          {t('publish.lifecycle.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('publish.lifecycle.noData')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box component="section" aria-label={t('publish.lifecycle.title')}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        {t('publish.lifecycle.title')}
      </Typography>

      {Object.entries(data.rounds).map(([round, entries]) => (
        <Box key={round} sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {t('publish.lifecycle.round', { round })}
          </Typography>

          {entries.map((entry) => (
            <ChainRow key={entry.id}>
              <StepChip
                icon={<ExploreOutlinedIcon />}
                label={entry.niche_name ?? t('publish.lifecycle.niche')}
                size="small"
                variant="outlined"
                color="info"
              />

              {entry.idea_text && (
                <>
                  <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  <StepChip
                    icon={<LightbulbOutlinedIcon />}
                    label={entry.idea_text}
                    size="small"
                    variant="outlined"
                    color="warning"
                    sx={{ maxWidth: 180 }}
                  />
                </>
              )}

              {entry.design && (
                <>
                  <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  <StepChip
                    icon={<BrushOutlinedIcon />}
                    label={t('publish.lifecycle.design')}
                    size="small"
                    variant="outlined"
                    color="secondary"
                  />
                </>
              )}

              {entry.listing_title && (
                <>
                  <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  <StepChip
                    icon={<ArticleOutlinedIcon />}
                    label={entry.listing_title}
                    size="small"
                    variant="outlined"
                    color="success"
                    sx={{ maxWidth: 180 }}
                  />
                </>
              )}

              {entry.asin && (
                <>
                  <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  <StepChip
                    icon={<InventoryOutlinedIcon />}
                    label={entry.asin}
                    size="small"
                    variant="outlined"
                    color="primary"
                    sx={{ fontFamily: MONO_FONT_STACK }}
                  />
                </>
              )}

              {entry.asin && !entry.sales_units && (
                <Typography variant="caption" color="text.secondary">
                  {t('publish.lifecycle.awaitingSales')}
                </Typography>
              )}
            </ChainRow>
          ))}
        </Box>
      ))}
    </Box>
  );
};

export default LifecycleChain;
