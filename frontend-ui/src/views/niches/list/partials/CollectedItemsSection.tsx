import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import { COLORS } from '@/style/constants';
import type { RootState } from '@/store';
import {
  selectCollectedSlogans,
  selectCollectedKeywords,
  removeSlogan,
  removeKeyword,
} from '@/store/collectedItemsSlice';

interface CollectedItemsSectionProps {
  nicheId: string;
}

const Section = styled(Box)({
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 16,
  background: 'rgba(11,39,49,0.40)',
});

export const CollectedItemsSection = ({ nicheId }: CollectedItemsSectionProps) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();

  const slogans = useSelector((s: RootState) => selectCollectedSlogans(s, nicheId));
  const keywords = useSelector((s: RootState) => selectCollectedKeywords(s, nicheId));

  if (slogans.length === 0 && keywords.length === 0) return null;

  const handleCopyAll = (items: string[]) => {
    navigator.clipboard.writeText(items.join(', '));
    enqueueSnackbar(t('niches.drawer.copiedAll'), { variant: 'success' });
  };

  return (
    <Section>
      {slogans.length > 0 && (
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ color: COLORS.snow }}>
              {t('niches.drawer.collectedSlogans')}
            </Typography>
            <Button
              size="small"
              startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
              onClick={() => handleCopyAll(slogans)}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              {t('niches.drawer.copyAll')}
            </Button>
          </Stack>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {slogans.map((slogan) => (
              <Chip
                key={slogan}
                label={slogan}
                size="small"
                onDelete={() => dispatch(removeSlogan({ nicheId, value: slogan }))}
                sx={(theme) => ({
                  backgroundColor: alpha(theme.palette.secondary.main, 0.12),
                  color: theme.vars.palette.secondary.main,
                  borderRadius: '6px',
                  mb: 0.5,
                })}
              />
            ))}
          </Stack>
        </Box>
      )}

      {keywords.length > 0 && (
        <Box sx={{ mt: slogans.length > 0 ? 2 : 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ color: COLORS.snow }}>
              {t('niches.drawer.collectedKeywords')}
            </Typography>
            <Button
              size="small"
              startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
              onClick={() => handleCopyAll(keywords)}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              {t('niches.drawer.copyAll')}
            </Button>
          </Stack>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {keywords.map((keyword) => (
              <Chip
                key={keyword}
                label={keyword}
                size="small"
                onDelete={() => dispatch(removeKeyword({ nicheId, value: keyword }))}
                sx={(theme) => ({
                  backgroundColor: alpha(theme.palette.info.main, 0.12),
                  color: theme.vars.palette.info.main,
                  borderRadius: '6px',
                  mb: 0.5,
                })}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Section>
  );
};
