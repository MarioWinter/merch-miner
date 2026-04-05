import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Grid, Skeleton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useListProjectsQuery, useCreateProjectMutation, useDeleteProjectMutation } from '@/store/designSlice';
import { COLORS } from '@/style/constants';
import ConfirmDialog from '@/components/ConfirmDialog';
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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const {
    data: projectData,
    isLoading,
    isError,
  } = useListProjectsQuery();

  const [createProject, { isLoading: isCreating }] = useCreateProjectMutation();
  const [deleteProject, { isLoading: isDeleting }] = useDeleteProjectMutation();

  const projects = useMemo(() => projectData?.results ?? [], [projectData?.results]);

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

  const handleDeleteRequest = useCallback(
    (projectId: string) => {
      const proj = projects.find((p) => p.id === projectId);
      setDeleteTarget(proj ? { id: proj.id, name: proj.name } : null);
    },
    [projects],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject(deleteTarget.id).unwrap();
      enqueueSnackbar(t('design.projects.deleteSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('design.projects.deleteError'), { variant: 'error' });
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteProject, enqueueSnackbar, t]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  // -- Loading state --
  if (isLoading) {
    return (
      <Box>
        <PageHeader>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="rounded" width={140} height={36} />
        </PageHeader>
        <Grid container spacing={3}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Grid key={i} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
              <SkeletonCard>
                <Skeleton variant="rectangular" sx={{ aspectRatio: '4 / 3' }} />
                <Box sx={{ p: 1.5 }}>
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
          <Grid key={project.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
            <ProjectCard
              project={project}
              onClick={handleCardClick}
              onDelete={handleDeleteRequest}
            />
          </Grid>
        ))}
      </Grid>

      <CreateProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreateProject}
        isSubmitting={isCreating}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('design.projects.deleteDialogTitle', 'Delete Project')}
        body={t('design.projects.deleteDialogBody', {
          name: deleteTarget?.name ?? '',
        })}
        confirmLabel={t('design.projects.deleteConfirm', 'Delete')}
        cancelLabel={t('design.projects.deleteCancel', 'Cancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isLoading={isDeleting}
      />
    </Box>
  );
};

export default ProjectGalleryView;
