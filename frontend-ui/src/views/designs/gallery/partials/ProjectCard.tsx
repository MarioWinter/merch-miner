import { Box, Chip, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { DesignProjectListItem } from '../types';

// -- Styled --

const CardRoot = styled(Box)(({ theme }) => ({
  cursor: 'pointer',
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid',
  borderColor: theme.vars.palette.divider,
  backgroundColor: COLORS.white,
  transition: `transform ${DURATION.fast}ms ${EASING.standard}, box-shadow ${DURATION.fast}ms ${EASING.standard}, border-color ${DURATION.fast}ms ${EASING.standard}`,
  ...theme.applyStyles('dark', {
    backgroundColor: COLORS.inkPaper,
  }),
  '&:hover': {
    transform: 'translateY(-2px)',
    borderColor: alpha(COLORS.red, 0.30),
    boxShadow: `0 8px 32px ${alpha(COLORS.black, 0.25)}`,
  },
}));

const ThumbnailArea = styled(Box)(({ theme }) => ({
  width: '100%',
  aspectRatio: '4 / 3',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
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

const CardBody = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

const MetaRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

// -- Component --

interface ProjectCardProps {
  project: DesignProjectListItem;
  onClick: (id: string) => void;
}

const ProjectCard = ({ project, onClick }: ProjectCardProps) => {
  const { t } = useTranslation();

  return (
    <CardRoot
      onClick={() => onClick(project.id)}
      role="button"
      tabIndex={0}
      aria-label={`${t('design.projects.openProject')} ${project.name}`}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(project.id);
        }
      }}
    >
      <ThumbnailArea>
        {project.thumbnail ? (
          <ThumbnailImage
            src={project.thumbnail}
            alt={project.name}
            loading="lazy"
          />
        ) : (
          <ImageOutlinedIcon
            sx={{
              fontSize: 48,
              color: 'text.disabled',
            }}
          />
        )}
      </ThumbnailArea>

      <CardBody>
        <Typography variant="h5" noWrap>
          {project.name}
        </Typography>

        <MetaRow>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <BrushOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {t('design.projects.designCount', { count: project.design_count })}
            </Typography>
          </Box>

          {project.niche_name && (
            <Chip
              label={project.niche_name}
              size="small"
              sx={{
                maxWidth: 140,
                backgroundColor: (theme) => alpha(theme.palette.secondary.main, 0.12),
                color: 'secondary.main',
              }}
            />
          )}
        </MetaRow>
      </CardBody>
    </CardRoot>
  );
};

export default ProjectCard;
