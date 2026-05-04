import { useCallback } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { BulkFlowButton } from '@/components/FlowButton';
import {
  useListNicheKeywordsQuery,
  useDeleteKeywordMutation,
} from '@/store/keywordSlice';
import { KeywordChipRow } from './partials/KeywordChipRow';
import { ManualKeywordInput } from './partials/ManualKeywordInput';

const Section = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(2),
}));

interface DrawerKeywordsSectionProps {
  nicheId: string;
}

/**
 * Lightweight keyword list for the niche drawer.
 *
 * Only supports add (via ManualKeywordInput) and delete. Group / drag /
 * design-template assignment removed 2026-05-04 per scope reduction —
 * these features may return as a separate "keyword board" feature.
 */
export const DrawerKeywordsSection = ({ nicheId }: DrawerKeywordsSectionProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const { data: keywordsData, isLoading } = useListNicheKeywordsQuery(
    { nicheId, page_size: 500 },
    { skip: !nicheId },
  );
  const [deleteKeyword] = useDeleteKeywordMutation();

  const keywords = keywordsData?.results ?? [];

  const handleDeleteKeyword = useCallback(
    async (keywordId: string) => {
      try {
        await deleteKeyword({ nicheId, keywordId }).unwrap();
      } catch {
        enqueueSnackbar(t('keywords.errors.deleteFailed'), { variant: 'error' });
      }
    },
    [nicheId, deleteKeyword, enqueueSnackbar, t],
  );

  return (
    <Section>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <VpnKeyIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Typography variant="subtitle2" fontWeight={600}>
          {t('keywords.drawer.sectionTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ({keywords.length})
        </Typography>
      </Stack>

      {/* Flat keyword list */}
      {isLoading ? (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', py: 1 }}>
          {t('common.loading', 'Loading...')}
        </Typography>
      ) : keywords.length === 0 ? (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', py: 1 }}>
          {t('keywords.drawer.noKeywords')}
        </Typography>
      ) : (
        <Stack spacing={0} sx={{ mb: 1 }}>
          {keywords.map((kw) => (
            <KeywordChipRow key={kw.id} keyword={kw} onDelete={handleDeleteKeyword} />
          ))}
        </Stack>
      )}

      {/* Manual add input */}
      <Box sx={{ mt: 2 }}>
        <ManualKeywordInput nicheId={nicheId} />
      </Box>

      {/* Navigate to full keyword page */}
      {keywords.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <BulkFlowButton
            target="keywords"
            label={t('keywords.drawer.viewAll')}
            count={keywords.length}
            onClick={() => navigate(`/amazon/keywords?niche=${nicheId}`)}
          />
        </Box>
      )}
    </Section>
  );
};
