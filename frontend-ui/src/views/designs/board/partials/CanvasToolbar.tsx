import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { COLORS } from '@/style/constants';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import MapIcon from '@mui/icons-material/Map';
import HubIcon from '@mui/icons-material/Hub';
import { useTranslation } from 'react-i18next';

interface CanvasToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onAddHub: () => void;
  onToggleMinimap: () => void;
  minimapVisible: boolean;
  nodeCount: number;
}

const ToolbarRoot = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 8,
  left: 16,
  right: 16,
  height: 40,
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(0.5),
  background: alpha(COLORS.inkPaper, 0.8),
  backdropFilter: 'blur(8px)',
  border: `1px solid ${alpha(COLORS.white, 0.08)}`,
  borderRadius: 8,
  padding: `0 ${theme.spacing(1.5)}`,
  ...theme.applyStyles('light', {
    background: alpha(COLORS.white, 0.8),
    border: `1px solid ${alpha(COLORS.ink, 0.08)}`,
  }),
}));

export const CanvasToolbar = ({
  onZoomIn,
  onZoomOut,
  onFitView,
  onAddHub,
  onToggleMinimap,
  minimapVisible,
  nodeCount,
}: CanvasToolbarProps) => {
  const { t } = useTranslation();

  return (
    <ToolbarRoot>
      <Stack direction="row" spacing={0.25} alignItems="center">
        <Tooltip title={t('design.board.zoomIn')}>
          <IconButton size="small" onClick={onZoomIn} aria-label={t('design.board.zoomIn')}>
            <ZoomInIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('design.board.zoomOut')}>
          <IconButton size="small" onClick={onZoomOut} aria-label={t('design.board.zoomOut')}>
            <ZoomOutIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('design.board.fitView')}>
          <IconButton size="small" onClick={onFitView} aria-label={t('design.board.fitView')}>
            <FitScreenIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        <Box sx={{ width: 1, height: 20, bgcolor: 'divider', mx: 0.5 }} />

        <Tooltip title={t('design.board.addHub')}>
          <IconButton size="small" onClick={onAddHub} aria-label={t('design.board.addHub')}>
            <HubIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('design.board.addImage')}>
          <IconButton size="small" aria-label={t('design.board.addImage')}>
            <AddCircleOutlineIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        <Box sx={{ width: 1, height: 20, bgcolor: 'divider', mx: 0.5 }} />

        <Tooltip title={t('design.board.toggleMinimap')}>
          <IconButton
            size="small"
            onClick={onToggleMinimap}
            color={minimapVisible ? 'secondary' : 'default'}
            aria-label={t('design.board.toggleMinimap')}
          >
            <MapIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          {t('design.board.nodeCount', { count: nodeCount })}
        </Typography>
      </Stack>
    </ToolbarRoot>
  );
};
