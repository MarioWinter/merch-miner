import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import { COLORS } from '@/style/constants';
import type { RootState } from '@/store';
import {
  selectCollectedKeywords,
  removeKeyword,
} from '@/store/collectedItemsSlice';
import { useListIdeasQuery, useDeleteIdeaMutation } from '@/store/ideaSlice';

interface CollectedItemsSectionProps {
  nicheId: string;
}

const Section = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: 16,
  background: alpha(COLORS.inkPaper, 0.40),
}));

export const CollectedItemsSection = ({ nicheId }: CollectedItemsSectionProps) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();

  // API-backed slogans (ideas with is_manual=true for this niche)
  const { data: ideasData } = useListIdeasQuery(
    { nicheId, page_size: 100 },
    { skip: !nicheId },
  );
  const slogans = (ideasData?.results ?? [])
    .filter((i) => i.is_manual || i.status === 'approved')
    .map((i) => ({ id: i.id, text: i.slogan_text, isApproved: i.status === 'approved' }));

  // Redux-only keywords
  const keywords = useSelector((s: RootState) => selectCollectedKeywords(s, nicheId));

  const [deleteIdea] = useDeleteIdeaMutation();

  if (slogans.length === 0 && keywords.length === 0) return null;

  const handleCopyAll = (items: string[]) => {
    navigator.clipboard.writeText(items.join(', '));
    enqueueSnackbar(t('niches.drawer.copiedAll'), { variant: 'success' });
  };

  const handleRemoveSlogan = async (ideaId: string) => {
    try {
      await deleteIdea({ id: ideaId }).unwrap();
    } catch {
      enqueueSnackbar(t('ideas.notifications.deleteError'), { variant: 'error' });
    }
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
              onClick={() => handleCopyAll(slogans.map((s) => s.text))}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              {t('niches.drawer.copyAll')}
            </Button>
          </Stack>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {slogans.map((slogan) => (
              <Chip
                key={slogan.id}
                label={slogan.text}
                size="small"
                icon={slogan.isApproved ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : undefined}
                onDelete={() => handleRemoveSlogan(slogan.id)}
                sx={{
                  backgroundColor: alpha(slogan.isApproved ? COLORS.successDk : COLORS.cyan, 0.12),
                  color: slogan.isApproved ? 'success.main' : 'secondary.main',
                  borderRadius: '6px',
                  mb: 0.5,
                  '& .MuiChip-icon': { color: 'success.main' },
                }}
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
