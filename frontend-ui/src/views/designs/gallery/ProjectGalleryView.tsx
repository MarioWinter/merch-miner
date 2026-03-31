import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Grid, Skeleton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useListProjectsQuery, useCreateProjectMutation } from '@/store/designSlice';
import { COLORS } from '@/style/constants';
import ProjectCard from './partials/ProjectCard';
import CreateProjectDialog from './partials/CreateProjectDialog';

// -- Styled --

const PageHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 24,
});

const EmptyRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(8),
}));

const SkeletonCard = styled(Box)(({ theme }) => ({
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid',
  borderColor: theme.vars.palette.divider,
  backgroundColor: COLORS.white,
  ...theme.applyStyles('dark', {
    backgroundColor: COLORS.inkPaper,
  }),
}));

// -- Component --

const ProjectGalleryView = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    data: projectData,
    isLoading,
    isError,
  } = useListProjectsQuery();

  const [createProject, { isLoading: isCreating }] = useCreateProjectMutation();

  const projects = projectData?.results ?? [];

  const handleCreateProject = async (name: string, nicheId?: string) => {
    try {
      const project = await createProject({
        name,
        niche: nicheId ?? null,
      }).unwrap();
      setDialogOpen(false);
      enqueueSnackbar(t('design.projects.createSuccess'), { variant: 'success' });
      navigate(`/designs/${project.id}`);
    } catch {
      enqueueSnackbar(t('design.projects.createError'), { variant: 'error' });
    }
  };

  const handleCardClick = (projectId: string) => {
    navigate(`/designs/${projectId}`);
  };

  // -- Loading state --
  if (isLoading) {
    return (
      <Box>
        <PageHeader>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="rounded" width={140} height={36} />
        </PageHeader>
        <Grid container spacing={3}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <SkeletonCard>
                <Skeleton variant="rectangular" sx={{ aspectRatio: '4 / 3' }} />
                <Box sx={{ p: 2 }}>
                  <Skeleton variant="text" width="70%" />
                  <Skeleton variant="text" width="40%" />
                </Box>
              </SkeletonCard>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  // -- Error state --
  if (isError) {
    return (
      <Box>
        <PageHeader>
          <Typography variant="h1">{t('design.projects.title')}</Typography>
        </PageHeader>
        <EmptyRoot>
          <Typography variant="h5" color="text.secondary">
            {t('design.projects.loadError')}
          </Typography>
        </EmptyRoot>
      </Box>
    );
  }

  // -- Empty state --
  if (projects.length === 0) {
    return (
      <Box>
        <PageHeader>
          <Typography variant="h1">{t('design.projects.title')}</Typography>
        </PageHeader>
        <EmptyRoot>
          <ImageOutlinedIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h5" color="text.secondary" sx={{ mb: 1 }}>
            {t('design.projects.emptyTitle')}
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
            {t('design.projects.emptyCta')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            {t('design.projects.createButton')}
          </Button>
        </EmptyRoot>

        <CreateProjectDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleCreateProject}
          isSubmitting={isCreating}
        />
      </Box>
    );
  }

  // -- Gallery --
  return (
    <Box>
      <PageHeader>
        <Typography variant="h1">{t('design.projects.title')}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          {t('design.projects.createButton')}
        </Button>
      </PageHeader>

      <Grid container spacing={3}>
        {projects.map((project) => (
          <Grid key={project.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <ProjectCard project={project} onClick={handleCardClick} />
          </Grid>
        ))}
      </Grid>

      <CreateProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreateProject}
        isSubmitting={isCreating}
      />
    </Box>
  );
};

export default ProjectGalleryView;
