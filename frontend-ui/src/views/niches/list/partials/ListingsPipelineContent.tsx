import { useNavigate } from 'react-router-dom';
import { Stack, Typography } from '@mui/material';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import { BulkFlowButton } from '@/components/FlowButton';
import { SummaryRow, CountValue } from '@/components/PipelineCard';

// ── Types ─────────────────────────────────────────────────────────
export interface ListingCounts {
  draft: number;
  ready: number;
  published: number;
}

interface ListingsPipelineContentProps {
  nicheId: string;
  counts?: ListingCounts;
}

// ── Component ─────────────────────────────────────────────────────
export const ListingsPipelineContent = ({
  nicheId,
  counts,
}: ListingsPipelineContentProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Placeholder — real counts come from PROJ-11 RTK Query
  const total = counts ? counts.draft + counts.ready + counts.published : 0;

  // ── Empty state ───────────────────────────────────────────────
  if (total === 0) {
    return (
      <Stack spacing={1.5}>
        <Stack alignItems="center" sx={{ py: 1.5 }}>
          <ArticleOutlinedIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {t('niches.pipeline.listings.emptyTitle', 'No listings yet')}
          </Typography>
          <Typography variant="caption" color="text.disabled" textAlign="center">
            {t('niches.pipeline.listings.emptyCta', 'Approve designs to start creating listings')}
          </Typography>
        </Stack>

        <BulkFlowButton
          target="listings"
          label={t('niches.pipeline.listings.openPublish', 'Open Publish')}
          onClick={() => navigate(`/listings?niche=${nicheId}`)}
        />
      </Stack>
    );
  }

  // ── Summary with counts ───────────────────────────────────────
  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.25}>
        <SummaryRow>
          <EditNoteOutlinedIcon sx={{ fontSize: 16, color: COLORS.warningDk }} />
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {t('niches.pipeline.listings.draft', 'Draft')}
          </Typography>
          <CountValue>{counts!.draft}</CountValue>
        </SummaryRow>

        <SummaryRow>
          <CheckCircleOutlinedIcon sx={{ fontSize: 16, color: COLORS.successDk }} />
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {t('niches.pipeline.listings.ready', 'Ready')}
          </Typography>
          <CountValue>{counts!.ready}</CountValue>
        </SummaryRow>

        <SummaryRow>
          <RocketLaunchOutlinedIcon sx={{ fontSize: 16, color: COLORS.red }} />
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {t('niches.pipeline.listings.published', 'Published')}
          </Typography>
          <CountValue>{counts!.published}</CountValue>
        </SummaryRow>
      </Stack>

      <BulkFlowButton
        target="listings"
        label={t('niches.pipeline.listings.openPublish', 'Open Publish')}
        onClick={() => navigate(`/listings?niche=${nicheId}`)}
      />
    </Stack>
  );
};
