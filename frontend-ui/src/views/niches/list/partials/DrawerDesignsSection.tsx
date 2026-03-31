import { useNavigate } from 'react-router-dom';
import { Box, Skeleton, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { useTranslation } from 'react-i18next';
import { useListProjectsQuery } from '@/store/designSlice';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { DesignProjectListItem } from '@/views/designs/gallery/types';

// -- Styled --

const Section = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(2),
}));

const ProjectRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1),
  borderRadius: 8,
  cursor: 'pointer',
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
}));

const Thumbnail = styled(Box)(({ theme }) => ({
  width: 48,
  height: 48,
  borderRadius: 8,
  overflow: 'hidden',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: COLORS.ash,
  ...theme.applyStyles('dark', {
    backgroundColor: COLORS.ink,
  }),
}));

const ThumbnailImage = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

const EmptyRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(2, 0),
}));

// -- Component --

interface DrawerDesignsSectionProps {
  nicheId: string;
}

export const DrawerDesignsSection = ({ nicheId }: DrawerDesignsSectionProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: projectData, isLoading } = useListProjectsQuery();

  const results = projectData?.results;
  const nicheProjects = results
    ? results.filter((p: DesignProjectListItem) => p.niche === nicheId)
    : [];

  const handleProjectClick = (projectId: string) => {
    navigate(`/designs/${projectId}`);
  };

  return (
    <Section>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <BrushOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Typography variant="subtitle2" fontWeight={600}>
          {t('design.projects.drawerSection.title')}
        </Typography>
        {!isLoading && (
          <Typography variant="caption" color="text.secondary">
            ({nicheProjects.length})
          </Typography>
        )}
      </Stack>

      {/* Loading state */}
      {isLoading && (
        <Stack spacing={1}>
          {Array.from({ length: 2 }).map((_, i) => (
            <Stack key={i} direction="row" alignItems="center" spacing={1.5} sx={{ p: 1 }}>
              <Skeleton variant="rounded" width={48} height={48} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="30%" />
              </Box>
            </Stack>
          ))}
        </Stack>
      )}

      {/* Empty state */}
      {!isLoading && nicheProjects.length === 0 && (
        <EmptyRoot>
          <ImageOutlinedIcon
            sx={{ fontSize: 36, color: 'text.disabled', mb: 0.5 }}
          />
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {t('design.projects.drawerSection.emptyTitle')}
          </Typography>
          <Typography variant="caption" color="text.disabled" textAlign="center">
            {t('design.projects.drawerSection.emptyCta')}
          </Typography>
        </EmptyRoot>
      )}

      {/* Project list */}
      {!isLoading && nicheProjects.length > 0 && (
        <Stack spacing={0.5}>
          {nicheProjects.map((project) => (
            <ProjectRow
              key={project.id}
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
              <Thumbnail>
                {project.thumbnail ? (
                  <ThumbnailImage
                    src={project.thumbnail}
                    alt={project.name}
                    loading="lazy"
                  />
                ) : (
                  <ImageOutlinedIcon
                    sx={{ fontSize: 24, color: 'text.disabled' }}
                  />
                )}
              </Thumbnail>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={500} noWrap>
                  {project.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('design.projects.drawerSection.designCount', {
                    count: project.design_count,
                  })}
                </Typography>
              </Box>
            </ProjectRow>
          ))}
        </Stack>
      )}
    </Section>
  );
};
