import { useCallback, useRef, useState } from 'react';
import { Box, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ImageIcon from '@mui/icons-material/Image';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import CategoryIcon from '@mui/icons-material/Category';
import BrushIcon from '@mui/icons-material/Brush';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DURATION, EASING } from '@/style/constants';
import type { CanvasElement, CanvasElementType } from '../../types';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const LAYER_ROW_HEIGHT = 36;

const TYPE_ICONS: Record<CanvasElementType, typeof ImageIcon> = {
  image: ImageIcon,
  text: TextFieldsIcon,
  shape: CategoryIcon,
  brush: BrushIcon,
  emoji: EmojiEmotionsIcon,
};

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const LayerRow = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$selected',
})<{ $selected?: boolean }>(({ theme, $selected }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  height: LAYER_ROW_HEIGHT,
  padding: theme.spacing(0, 1),
  cursor: 'pointer',
  borderRadius: theme.shape.borderRadius,
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}`,
  backgroundColor: $selected
    ? `color-mix(in srgb, ${theme.vars.palette.primary.main} 20%, transparent)`
    : 'transparent',
  '&:hover': {
    backgroundColor: $selected
      ? `color-mix(in srgb, ${theme.vars.palette.primary.main} 28%, transparent)`
      : theme.vars.palette.action.hover,
  },
}));

const DragHandle = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  cursor: 'grab',
  flexShrink: 0,
  '&:active': { cursor: 'grabbing' },
});

const LayerName = styled(Typography)({
  flex: 1,
  minWidth: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: '0.75rem',
  userSelect: 'none',
});

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

export interface SortableLayerRowProps {
  layer: CanvasElement;
  artboardId: string;
  isSelected: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onToggleLock: () => void;
  onRename: (name: string) => void;
  visibleLabel: string;
  lockLabel: string;
  renameLabel: string;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const SortableLayerRow = ({
  layer,
  isSelected,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onRename,
  visibleLabel,
  lockLabel,
  renameLabel,
}: SortableLayerRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: layer.id });

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative' as const,
  };

  const TypeIcon = TYPE_ICONS[layer.type];

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== layer.name) {
      onRename(trimmed);
    }
    setIsEditing(false);
  }, [editValue, layer.name, onRename]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditValue(layer.name);
      setIsEditing(true);
      // Focus after render
      setTimeout(() => inputRef.current?.select(), 0);
    },
    [layer.name],
  );

  return (
    <div ref={setNodeRef} style={style}>
      <LayerRow
        $selected={isSelected}
        onClick={onSelect}
        aria-selected={isSelected}
        role="option"
        sx={{ opacity: layer.visible ? 1 : 0.5 }}
      >
        {/* Drag handle */}
        <DragHandle {...attributes} {...listeners}>
          <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
        </DragHandle>

        {/* Type icon */}
        <TypeIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />

        {/* Name (editable on double-click) */}
        {isEditing ? (
          <TextField
            inputRef={inputRef}
            size="small"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            aria-label={renameLabel}
            sx={{ flex: 1, minWidth: 0 }}
            slotProps={{
              htmlInput: {
                style: { fontSize: '0.75rem', padding: '2px 6px' },
              },
            }}
          />
        ) : (
          <LayerName
            variant="body2"
            color="text.primary"
            onDoubleClick={handleDoubleClick}
            title={layer.name}
          >
            {layer.name}
          </LayerName>
        )}

        {/* Visibility toggle */}
        <Tooltip title={visibleLabel} placement="top" arrow>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisible();
            }}
            aria-label={visibleLabel}
            sx={{ p: 0.25 }}
          >
            {layer.visible ? (
              <VisibilityIcon sx={{ fontSize: 16 }} />
            ) : (
              <VisibilityOffIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
            )}
          </IconButton>
        </Tooltip>

        {/* Lock toggle */}
        <Tooltip title={lockLabel} placement="top" arrow>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock();
            }}
            aria-label={lockLabel}
            sx={{ p: 0.25 }}
          >
            {layer.locked ? (
              <LockIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            ) : (
              <LockOpenIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
            )}
          </IconButton>
        </Tooltip>
      </LayerRow>
    </div>
  );
};

export default SortableLayerRow;
