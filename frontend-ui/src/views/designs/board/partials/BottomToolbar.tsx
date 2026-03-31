import { useCallback } from 'react';
import { Box, Tooltip } from '@mui/material';
import NearMeIcon from '@mui/icons-material/NearMe';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import CategoryIcon from '@mui/icons-material/Category';
import BrushIcon from '@mui/icons-material/Brush';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import RedoRoundedIcon from '@mui/icons-material/RedoRounded';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import { useTranslation } from 'react-i18next';
import ShapesMenu from './ShapesMenu';
import {
  ToolbarRoot,
  ToolButton,
  AiSparkleButton,
  ZoomText,
  ToolbarDivider,
} from './BottomToolbar.styles';

// -----------------------------------------------------------------
// Re-exports (used by parent)
// -----------------------------------------------------------------

export { BOTTOM_TOOLBAR_HEIGHT } from './BottomToolbar.styles';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export type CanvasTool =
  | 'cursor'
  | 'move'
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'line'
  | 'brush'
  | 'text'
  | 'emoji';

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface BottomToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  onZoomTo: (zoom: number) => void;
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onAiSparkle: () => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const BottomToolbar = ({
  zoom,
  onZoomTo,
  onFitToView,
  activeTool,
  onToolChange,
  onAiSparkle,
}: BottomToolbarProps) => {
  const { t } = useTranslation();

  const isShapeTool =
    activeTool === 'rectangle' ||
    activeTool === 'ellipse' ||
    activeTool === 'triangle' ||
    activeTool === 'line';

  const zoomPercent = `${Math.round(zoom * 100)}%`;

  const handleZoomIn = useCallback(() => {
    onZoomTo(Math.min(MAX_ZOOM, zoom + ZOOM_STEP));
  }, [zoom, onZoomTo]);

  const handleZoomOut = useCallback(() => {
    onZoomTo(Math.max(MIN_ZOOM, zoom - ZOOM_STEP));
  }, [zoom, onZoomTo]);

  return (
    <ToolbarRoot aria-label={t('design.toolbar.ariaLabel', 'Canvas toolbar')}>
      {/* -- Drawing Tools -- */}
      <Tooltip title={t('design.toolbar.cursor', 'Cursor')}>
        <ToolButton
          $active={activeTool === 'cursor'}
          onClick={() => onToolChange('cursor')}
          aria-label={t('design.toolbar.cursor', 'Cursor')}
          aria-pressed={activeTool === 'cursor'}
        >
          <NearMeIcon sx={{ fontSize: 18 }} />
        </ToolButton>
      </Tooltip>

      <Tooltip title={t('design.toolbar.move', 'Move')}>
        <ToolButton
          $active={activeTool === 'move'}
          onClick={() => onToolChange('move')}
          aria-label={t('design.toolbar.move', 'Move')}
          aria-pressed={activeTool === 'move'}
        >
          <OpenWithIcon sx={{ fontSize: 18 }} />
        </ToolButton>
      </Tooltip>

      <ShapesMenu activeTool={activeTool} onSelect={onToolChange}>
        {({ onClick, open }) => (
          <Tooltip title={t('design.toolbar.shapes', 'Shapes')}>
            <ToolButton
              $active={isShapeTool}
              onClick={onClick}
              aria-label={t('design.toolbar.shapes', 'Shapes')}
              aria-pressed={isShapeTool}
              aria-haspopup="true"
              aria-expanded={open}
            >
              <CategoryIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
        )}
      </ShapesMenu>

      <Tooltip title={t('design.toolbar.brush', 'Brush')}>
        <ToolButton
          $active={activeTool === 'brush'}
          onClick={() => onToolChange('brush')}
          aria-label={t('design.toolbar.brush', 'Brush')}
          aria-pressed={activeTool === 'brush'}
        >
          <BrushIcon sx={{ fontSize: 18 }} />
        </ToolButton>
      </Tooltip>

      <Tooltip title={t('design.toolbar.text', 'Text')}>
        <ToolButton
          $active={activeTool === 'text'}
          onClick={() => onToolChange('text')}
          aria-label={t('design.toolbar.text', 'Text')}
          aria-pressed={activeTool === 'text'}
        >
          <TextFieldsIcon sx={{ fontSize: 18 }} />
        </ToolButton>
      </Tooltip>

      <Tooltip title={t('design.toolbar.emoji', 'Emoji')}>
        <ToolButton
          $active={activeTool === 'emoji'}
          onClick={() => onToolChange('emoji')}
          aria-label={t('design.toolbar.emoji', 'Emoji')}
          aria-pressed={activeTool === 'emoji'}
        >
          <EmojiEmotionsIcon sx={{ fontSize: 18 }} />
        </ToolButton>
      </Tooltip>

      <Tooltip title={t('design.toolbar.aiSparkle', 'AI Generate')}>
        <AiSparkleButton
          onClick={onAiSparkle}
          aria-label={t('design.toolbar.aiSparkle', 'AI Generate')}
        >
          <AutoAwesomeIcon sx={{ fontSize: 18 }} />
        </AiSparkleButton>
      </Tooltip>

      <ToolbarDivider orientation="vertical" flexItem />

      {/* -- Undo / Redo (placeholder, disabled) -- */}
      <Tooltip title={t('design.toolbar.undo', 'Undo')}>
        <span>
          <ToolButton disabled aria-label={t('design.toolbar.undo', 'Undo')}>
            <UndoRoundedIcon sx={{ fontSize: 18 }} />
          </ToolButton>
        </span>
      </Tooltip>

      <Tooltip title={t('design.toolbar.redo', 'Redo')}>
        <span>
          <ToolButton disabled aria-label={t('design.toolbar.redo', 'Redo')}>
            <RedoRoundedIcon sx={{ fontSize: 18 }} />
          </ToolButton>
        </span>
      </Tooltip>

      <ToolbarDivider orientation="vertical" flexItem />

      {/* -- Zoom Controls -- */}
      <Tooltip title={t('design.toolbar.zoomOut', 'Zoom out')}>
        <ToolButton
          onClick={handleZoomOut}
          aria-label={t('design.toolbar.zoomOut', 'Zoom out')}
        >
          <RemoveIcon sx={{ fontSize: 18 }} />
        </ToolButton>
      </Tooltip>

      <ZoomText variant="caption">{zoomPercent}</ZoomText>

      <Tooltip title={t('design.toolbar.zoomIn', 'Zoom in')}>
        <ToolButton
          onClick={handleZoomIn}
          aria-label={t('design.toolbar.zoomIn', 'Zoom in')}
        >
          <AddIcon sx={{ fontSize: 18 }} />
        </ToolButton>
      </Tooltip>

      <Tooltip title={t('design.toolbar.fitToView', 'Fit to view')}>
        <ToolButton
          onClick={onFitToView}
          aria-label={t('design.toolbar.fitToView', 'Fit to view')}
        >
          <FitScreenIcon sx={{ fontSize: 18 }} />
        </ToolButton>
      </Tooltip>

      <Box sx={{ flex: 1 }} />
    </ToolbarRoot>
  );
};

export default BottomToolbar;
