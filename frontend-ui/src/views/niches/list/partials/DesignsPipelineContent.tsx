import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useListProjectsQuery, useLazyGetProjectBoardQuery } from '@/store/designSlice';
import { COLORS, DURATION, EASING, radius } from '@/style/constants';
import { InlineFlowButton } from '@/components/FlowButton';
import useSendDesignsToListings from '@/hooks/useSendDesignsToListings';
import BulkConfirmDialog from '@/views/designs/workspace/partials/BulkConfirmDialog';
import type { DesignProjectListItem } from '@/views/designs/gallery/types';

// ── Props ──────────────────────────────────────────────────────────
interface DesignsPipelineContentProps {
  nicheId: string;
}

// ── Styled ─────────────────────────────────────────────────────────
const ProjectRow = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  padding: theme.spacing(0.75, 1),
  borderRadius: radius(theme, 0.75),
  cursor: 'pointer',
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
}));

const ThumbnailStrip = styled(Stack)(({ theme }) => ({
  paddingLeft: theme.spacing(4),
  paddingBottom: theme.spacing(0.5),
  gap: theme.spacing(0.75),
  flexDirection: 'row',
  flexWrap: 'nowrap',
  overflow: 'hidden',
}));

const Thumb = styled(Box)(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: radius(theme, 0.75),
  overflow: 'hidden',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: COLORS.inkElevated,
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.ash,
  }),
}));

const ThumbImage = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

const CountBadge = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 20,
  height: 20,
  padding: theme.spacing(0, 0.5),
  borderRadius: radius(theme, 0.5),
  backgroundColor: alpha(COLORS.cyan, 0.12),
  color: COLORS.cyan,
  ...theme.typography.overline,
  fontSize: '0.625rem',
  fontWeight: 600,
  lineHeight: 1,
}));

// ── Component ──────────────────────────────────────────────────────
export const DesignsPipelineContent = ({ nicheId }: DesignsPipelineContentProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const { data: projectData, isLoading } = useListProjectsQuery();
  const [fetchProjectBoard] = useLazyGetProjectBoardQuery();
  const sendToListings = useSendDesignsToListings();
  const [sendingProjectId, setSendingProjectId] = useState<string | null>(null);

  const nicheProjects = (projectData?.results ?? []).filter(
    (p: DesignProjectListItem) => p.niche === nicheId,
  );

  const handleProjectClick = (projectId: string) => {
    navigate(`/designs/${projectId}`);
  };

  const handleSendProject = useCallback(
    async (projectId: string) => {
      setSendingProjectId(projectId);
      try {
        const board = await fetchProjectBoard({ projectId }).unwrap();
        const approvedIds = (board.designs ?? [])
          .filter((d) => d.status === 'approved')
          .map((d) => d.id);
        await sendToListings.send(approvedIds);
      } catch {
        enqueueSnackbar(t('common.unexpectedError', 'Unexpected error'), { variant: 'error' });
      } finally {
        setSendingProjectId(null);
      }
    },
    [fetchProjectBoard, sendToListings, enqueueSnackbar, t],
  );

  // ── Loading skeleton ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <Stack spacing={1}>
        {Array.from({ length: 2 }).map((_, i) => (
          <Box key={i}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 0.75 }}>
              <Skeleton variant="rounded" width={18} height={18} />
              <Skeleton variant="text" width="50%" />
              <Skeleton variant="rounded" width={20} height={20} />
            </Stack>
            <Stack direction="row" spacing={0.75} sx={{ pl: 4 }}>
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} variant="rounded" width={36} height={36} />
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────
  if (nicheProjects.length === 0) {
    return (
      <Stack alignItems="center" sx={{ py: 1.5 }}>
        <ImageOutlinedIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {t('design.projects.drawerSection.emptyTitle', 'No design projects yet')}
        </Typography>
        <Typography variant="caption" color="text.disabled" textAlign="center">
          {t('design.projects.drawerSection.emptyCta', 'Forge slogans to start designing')}
        </Typography>
      </Stack>
    );
  }

  // ── Project list ─────────────────────────────────────────────────
  return (
    <Box>
      <Stack spacing={0.5}>
        {nicheProjects.map((project) => (
          <Box key={project.id}>
            {/* Project row */}
            <ProjectRow
              direction="row"
              spacing={1}
              onClick={() => handleProjectClick(project.id)}
              role="button"
              tabIndex={0}
              aria-label={`${t('design.projects.drawerSection.openBoard', 'Open board')} ${project.name}`}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleProjectClick(project.id);
                }
              }}
            >
              <FolderOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />

              <Typography variant="subtitle2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                {project.name}
              </Typography>

              <CountBadge>{project.design_count}</CountBadge>

              <InlineFlowButton
                target="listings"
                tooltip={t('designs.sendToListings.cta', 'Send to Listings')}
                onClick={(e) => {
                  e?.stopPropagation();
                  void handleSendProject(project.id);
                }}
                disabled={sendingProjectId === project.id || sendToListings.isSending}
              />
            </ProjectRow>

            {/* Thumbnail strip (max 4) */}
            {project.thumbnail && (
              <ThumbnailStrip>
                <Thumb>
                  <ThumbImage
                    src={project.thumbnail}
                    alt={project.name}
                    loading="lazy"
                  />
                </Thumb>
              </ThumbnailStrip>
            )}
          </Box>
        ))}
      </Stack>

      {/* Open Canvas ghost button */}
      <Button
        variant="text"
        size="small"
        startIcon={<OpenInNewOutlinedIcon sx={{ fontSize: 16 }} />}
        onClick={() => navigate('/designs')}
        sx={{
          mt: 1.5,
          width: '100%',
          color: 'text.secondary',
          justifyContent: 'center',
          '&:hover': {
            color: 'text.primary',
            backgroundColor: alpha(COLORS.white, 0.04),
          },
        }}
      >
        {t('niches.pipeline.designs.openCanvas', 'Open Design Canvas')}
      </Button>

      <BulkConfirmDialog
        open={Boolean(sendToListings.pendingConfirm)}
        count={sendToListings.pendingConfirm?.designIds.length ?? 0}
        isSending={sendToListings.isSending}
        onConfirm={() => { void sendToListings.confirmPending(); }}
        onCancel={sendToListings.cancelPending}
      />
    </Box>
  );
};
