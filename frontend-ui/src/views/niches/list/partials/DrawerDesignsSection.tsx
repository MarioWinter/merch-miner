import { useNavigate } from 'react-router-dom';
import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import { useTranslation } from 'react-i18next';
import { useListProjectsQuery } from '@/store/designSlice';
import { COLORS, DURATION, EASING } from '@/style/constants';
import { InlineFlowButton } from '@/components/FlowButton';
import type { DesignProjectListItem } from '@/views/designs/gallery/types';

// ── Styled ────────────────────────────────────────────────────────
const ProjectRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0.75, 1),
  borderRadius: theme.shape.borderRadius,
  cursor: 'pointer',
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
}));

const CountBadge = styled(Typography)(({ theme }) => ({
  ...theme.typography.overline,
  fontSize: '0.6875rem',
  fontWeight: 600,
  lineHeight: '20px',
  minWidth: 24,
  textAlign: 'center',
  padding: theme.spacing(0, 0.75),
  borderRadius: theme.shape.borderRadius * 0.75,
  backgroundColor: alpha(COLORS.cyan, 0.12),
  color: COLORS.cyan,
}));

const ThumbRow = styled(Stack)(({ theme }) => ({
  paddingLeft: theme.spacing(3.5), // indent under folder icon
}));

const Thumb = styled(Box)(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: 6,
  overflow: 'hidden',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: COLORS.inkElevated,
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.ash,
  }),
}));

const GhostButton = styled(Button)(({ theme }) => ({
  width: '100%',
  borderStyle: 'dashed',
  borderColor: theme.vars.palette.divider,
  color: theme.vars.palette.text.secondary,
  textTransform: 'none',
  fontWeight: 500,
  transition: [
    `border-color ${DURATION.fast}ms ${EASING.standard}`,
    `color ${DURATION.fast}ms ${EASING.standard}`,
  ].join(', '),
  '&:hover': {
    borderColor: COLORS.cyan,
    color: COLORS.cyan,
    backgroundColor: alpha(COLORS.cyan, 0.06),
  },
}));

const EmptyRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(2, 0),
}));

// ── Component ─────────────────────────────────────────────────────
interface DrawerDesignsSectionProps {
  nicheId: string;
}

export const DrawerDesignsSection = ({ nicheId }: DrawerDesignsSectionProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: projectData, isLoading } = useListProjectsQuery();

  const nicheProjects = (projectData?.results ?? []).filter(
    (p: DesignProjectListItem) => p.niche === nicheId,
  );

  const handleProjectClick = (projectId: string) => {
    navigate(`/designs/${projectId}`);
  };

  // ── Loading ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Stack spacing={1}>
        {Array.from({ length: 2 }).map((_, i) => (
          <Stack key={i} direction="row" alignItems="center" spacing={1} sx={{ p: 0.75 }}>
            <Skeleton variant="rounded" width={20} height={20} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" />
            </Box>
            <Skeleton variant="rounded" width={24} height={20} />
          </Stack>
        ))}
      </Stack>
    );
  }

  // ── Empty ───────────────────────────────────────────────────────
  if (nicheProjects.length === 0) {
    return (
      <EmptyRoot>
        <ImageOutlinedIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 0.5 }} />
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {t('design.projects.drawerSection.emptyTitle')}
        </Typography>
        <Typography variant="caption" color="text.disabled" textAlign="center">
          {t('design.projects.drawerSection.emptyCta')}
        </Typography>
      </EmptyRoot>
    );
  }

  return (
    <Stack spacing={0.5}>
      {nicheProjects.map((project) => (
        <Box key={project.id}>
          {/* Project row: folder + name + count + flow button */}
          <ProjectRow
            onClick={() => handleProjectClick(project.id)}
            role="button"
            tabIndex={0}
            aria-label={`${t('design.projects.drawerSection.openBoard')} ${project.name}`}
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
              tooltip={t('design.projects.drawerSection.sendToListings', 'Send to Listings')}
              onClick={() => {/* TODO: PROJ-11 listing flow */}}
            />
          </ProjectRow>

          {/* Thumbnail preview */}
          {project.thumbnail && (
            <ThumbRow direction="row" spacing={0.75} sx={{ mt: 0.5 }}>
              <Thumb>
                <img src={project.thumbnail} alt={project.name} loading="lazy" />
              </Thumb>
              {project.design_count > 1 && (
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  +{project.design_count - 1}
                </Typography>
              )}
            </ThumbRow>
          )}
        </Box>
      ))}

      {/* Open Canvas ghost button */}
      <GhostButton
        variant="outlined"
        size="small"
        startIcon={<BrushOutlinedIcon sx={{ fontSize: 16 }} />}
        onClick={() => navigate('/designs')}
        sx={{ mt: 1 }}
      >
        {t('design.projects.drawerSection.openCanvas', 'Open Canvas')}
      </GhostButton>
    </Stack>
  );
};
