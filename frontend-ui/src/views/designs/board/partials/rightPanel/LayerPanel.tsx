import { useCallback, useMemo, useRef, useState } from 'react';
import { Box, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { DURATION, EASING } from '@/style/constants';
import type { CanvasElement, CanvasElementType } from '../../types';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const LAYER_ROW_HEIGHT = 36;
const MAX_VISIBLE_LAYERS = 12;

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

const ListContainer = styled(Box)({
  maxHeight: LAYER_ROW_HEIGHT * MAX_VISIBLE_LAYERS,
  overflowY: 'auto',
  overflowX: 'hidden',
});

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

interface LayerPanelProps {
  artboardId: string;
  layers: CanvasElement[];
  selectedElementId: string | null;
  onSelectElement: (artboardId: string, elementId: string) => void;
  onUpdateElement: (
    artboardId: string,
    elementId: string,
    patch: Partial<Omit<CanvasElement, 'id' | 'type'>>,
  ) => void;
  onReorderElement: (artboardId: string, elementId: string, newIndex: number) => void;
}

// -----------------------------------------------------------------
// SortableLayerRow
// -----------------------------------------------------------------

interface SortableLayerRowProps {
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

// -----------------------------------------------------------------
// LayerPanel
// -----------------------------------------------------------------

const LayerPanel = ({
  artboardId,
  layers,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onReorderElement,
}: LayerPanelProps) => {
  const { t } = useTranslation();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Sort layers by zIndex descending (highest = top of list, like Figma/Photoshop)
  const sortedLayers = useMemo(
    () => [...layers].sort((a, b) => b.zIndex - a.zIndex),
    [layers],
  );

  const sortableIds = useMemo(() => sortedLayers.map((l) => l.id), [sortedLayers]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedLayers.findIndex((l) => l.id === active.id);
      const newIndex = sortedLayers.findIndex((l) => l.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      // Convert visual index (descending) back to ascending zIndex position.
      // sortedLayers is desc by zIndex, so visual index 0 = highest zIndex.
      // reorderElement expects ascending zIndex index, so invert.
      const ascendingNewIndex = sortedLayers.length - 1 - newIndex;
      onReorderElement(artboardId, String(active.id), ascendingNewIndex);
    },
    [artboardId, sortedLayers, onReorderElement],
  );

  const visibleLabel = t('design.canvas.layers.visible', 'Toggle visibility');
  const lockLabel = t('design.canvas.layers.lock', 'Toggle lock');
  const renameLabel = t('design.canvas.layers.rename', 'Rename layer');

  if (layers.length === 0) {
    return (
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="caption" color="text.disabled">
          {t('design.canvas.layers.empty', 'No layers')}
        </Typography>
      </Box>
    );
  }

  return (
    <ListContainer role="listbox" aria-label={t('design.canvas.layers.title', 'Layers')}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {sortedLayers.map((layer) => (
            <SortableLayerRow
              key={layer.id}
              layer={layer}
              artboardId={artboardId}
              isSelected={layer.id === selectedElementId}
              onSelect={() => onSelectElement(artboardId, layer.id)}
              onToggleVisible={() =>
                onUpdateElement(artboardId, layer.id, { visible: !layer.visible })
              }
              onToggleLock={() =>
                onUpdateElement(artboardId, layer.id, { locked: !layer.locked })
              }
              onRename={(name) => onUpdateElement(artboardId, layer.id, { name })}
              visibleLabel={visibleLabel}
              lockLabel={lockLabel}
              renameLabel={renameLabel}
            />
          ))}
        </SortableContext>
      </DndContext>
    </ListContainer>
  );
};

export default LayerPanel;
