import { useCallback, useState } from 'react';
import { Box, Chip, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
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
  position: 'relative',
  transition: `transform ${DURATION.fast}ms ${EASING.standard}, box-shadow ${DURATION.fast}ms ${EASING.standard}, border-color ${DURATION.fast}ms ${EASING.standard}`,
  ...theme.applyStyles('dark', {
    backgroundColor: COLORS.inkPaper,
  }),
  '&:hover': {
    transform: 'translateY(-2px)',
    borderColor: alpha(COLORS.red, 0.30),
    boxShadow: `0 8px 32px ${alpha(COLORS.black, 0.25)}`,
  },
  '&:hover .project-card-menu': {
    opacity: 1,
  },
}));

const ThumbnailArea = styled(Box)(({ theme }) => ({
  width: '100%',
  aspectRatio: '4 / 3',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  position: 'relative',
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

const MenuButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: 4,
  right: 4,
  opacity: 0,
  transition: `opacity ${DURATION.fast}ms ${EASING.standard}`,
  backgroundColor: alpha(COLORS.ink, 0.7),
  backdropFilter: 'blur(4px)',
  color: COLORS.snow,
  '&:hover': {
    backgroundColor: COLORS.inkElevated,
    color: COLORS.snow,
  },
}));

const CardBody = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
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
  onDelete: (id: string) => void;
}

const ProjectCard = ({ project, onClick, onDelete }: ProjectCardProps) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleDelete = useCallback(() => {
    handleMenuClose();
    onDelete(project.id);
  }, [handleMenuClose, onDelete, project.id]);

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
              fontSize: 36,
              color: 'text.disabled',
            }}
          />
        )}

        <MenuButton
          className="project-card-menu"
          size="small"
          onClick={handleMenuOpen}
          aria-label={t('design.projects.menuLabel', 'Project actions')}
        >
          <MoreVertIcon sx={{ fontSize: 18 }} />
        </MenuButton>

        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={handleMenuClose}
          onClick={(e) => e.stopPropagation()}
          slotProps={{
            paper: {
              sx: {
                minWidth: 180,
                bgcolor: 'background.paper',
                borderColor: 'divider',
              },
            },
          }}
        >
          <MenuItem onClick={handleDelete}>
            <ListItemIcon>
              <DeleteOutlineIcon sx={{ fontSize: 20, color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText
              sx={{ '& .MuiTypography-root': { color: 'error.main' } }}
            >
              {t('design.projects.deleteProject', 'Delete Project')}
            </ListItemText>
          </MenuItem>
        </Menu>
      </ThumbnailArea>

      <CardBody>
        <Typography variant="subtitle2" noWrap>
          {project.name}
        </Typography>

        <MetaRow>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <BrushOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {t('design.projects.designCount', { count: project.design_count })}
            </Typography>
          </Box>

          {project.niche_name && (
            <Chip
              label={project.niche_name}
              size="small"
              sx={{
                maxWidth: 100,
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
