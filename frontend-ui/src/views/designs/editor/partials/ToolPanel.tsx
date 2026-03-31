import { Box, Typography, Button, Switch, IconButton, Tooltip, Collapse } from '@mui/material';
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
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { useState } from 'react';
import { TOOL_CATALOG } from '../types';
import type { PipelineTool } from '../types';
import { PipelinePresetDropdown } from './PipelinePresetDropdown';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const PanelRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  padding: theme.spacing(2),
  gap: theme.spacing(1.5),
}));

const ToolCard = styled(Box)(({ theme }) => ({
  border: '1px solid',
  borderColor: theme.vars.palette.divider,
  borderRadius: 8,
  overflow: 'hidden',
}));

const ToolCardHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 8px',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  ...theme.applyStyles('light', {
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.02)',
    },
  }),
}));

const ToolCardBody = styled(Box)(({ theme }) => ({
  padding: '8px 12px 12px',
  borderTop: '1px solid',
  borderColor: theme.vars.palette.divider,
}));

const BottomActions = styled(Box)({
  marginTop: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingTop: 12,
});

// -----------------------------------------------------------------
// SortableToolCard sub-component
// -----------------------------------------------------------------

interface SortableToolCardProps {
  tool: PipelineTool;
  isExpanded: boolean;
  onToggleCard: (id: string) => void;
  onToggleTool: (id: string) => void;
  onRemoveTool: (id: string) => void;
  label: string;
  t: (key: string) => string;
}

const SortableToolCard = ({
  tool,
  isExpanded,
  onToggleCard,
  onToggleTool,
  onRemoveTool,
  label,
  t,
}: SortableToolCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tool.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <ToolCard>
        <ToolCardHeader onClick={() => onToggleCard(tool.id)}>
          <DragIndicatorIcon
            {...listeners}
            sx={{
              fontSize: 16,
              color: 'text.disabled',
              cursor: isDragging ? 'grabbing' : 'grab',
              flexShrink: 0,
            }}
            aria-label={t('design.pipeline.dragToReorder')}
          />
          <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
            {label}
          </Typography>
          <Switch
            size="small"
            checked={tool.enabled}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onToggleTool(tool.id)}
            aria-label={t('design.pipeline.toggleTool')}
          />
          <Tooltip title={t('design.pipeline.removeTool')}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveTool(tool.id);
              }}
              aria-label={t('design.pipeline.removeTool')}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          {isExpanded
            ? <ExpandLessIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            : <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
        </ToolCardHeader>

        <Collapse in={isExpanded}>
          <ToolCardBody>
            <Typography variant="caption" color="text.disabled">
              {label} parameters (Phase B4)
            </Typography>
          </ToolCardBody>
        </Collapse>
      </ToolCard>
    </div>
  );
};

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ToolPanelProps {
  activePipeline: PipelineTool[];
  onRemoveTool: (toolId: string) => void;
  onToggleTool: (toolId: string) => void;
  onReorder: (tools: PipelineTool[]) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const ToolPanel = ({
  activePipeline,
  onRemoveTool,
  onToggleTool,
  onReorder,
}: ToolPanelProps) => {
  const { t } = useTranslation();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const toggleCard = (toolId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = activePipeline.findIndex((t) => t.id === active.id);
    const newIndex = activePipeline.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(activePipeline, oldIndex, newIndex));
  };

  const handleResetAll = () => {
    onReorder(activePipeline.map((tool) => ({ ...tool, params: {}, enabled: true })));
  };

  const handleRemoveAll = () => {
    activePipeline.forEach((tool) => onRemoveTool(tool.id));
  };

  const handleLoadPreset = (tools: PipelineTool[]) => {
    onReorder(tools.map((tool) => ({ ...tool, id: crypto.randomUUID() })));
  };

  const sortableIds = activePipeline.map((tool) => tool.id);

  return (
    <PanelRoot>
      {/* Preset selector */}
      <PipelinePresetDropdown
        activePipeline={activePipeline}
        onLoadPreset={handleLoadPreset}
      />

      {/* Active tool cards */}
      {activePipeline.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.disabled">
            {t('design.pipeline.noTools')}
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
            {t('design.pipeline.noToolsCta')}
          </Typography>
        </Box>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {activePipeline.map((tool) => {
                const def = TOOL_CATALOG.find((tc) => tc.name === tool.name);
                return (
                  <SortableToolCard
                    key={tool.id}
                    tool={tool}
                    isExpanded={expandedCards.has(tool.id)}
                    onToggleCard={toggleCard}
                    onToggleTool={onToggleTool}
                    onRemoveTool={onRemoveTool}
                    label={def ? t(def.labelKey) : tool.name}
                    t={t}
                  />
                );
              })}
            </Box>
          </SortableContext>
        </DndContext>
      )}

      {/* Bottom actions */}
      {activePipeline.length > 0 && (
        <BottomActions>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
            onClick={handleResetAll}
            fullWidth
          >
            {t('design.editor.resetAll')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteSweepIcon sx={{ fontSize: 16 }} />}
            onClick={handleRemoveAll}
            fullWidth
          >
            {t('design.editor.removeAll')}
          </Button>
        </BottomActions>
      )}
    </PanelRoot>
  );
};
