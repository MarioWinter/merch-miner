import { useCallback, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
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
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import type { CanvasElement } from '../../types';
import SortableLayerRow from './SortableLayerRow';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const LAYER_ROW_HEIGHT = 36;
const MAX_VISIBLE_LAYERS = 12;

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const ListContainer = styled(Box)({
  maxHeight: LAYER_ROW_HEIGHT * MAX_VISIBLE_LAYERS,
  overflowY: 'auto',
  overflowX: 'hidden',
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
