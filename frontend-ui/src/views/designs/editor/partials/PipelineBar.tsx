import { Box, Chip, IconButton, Typography, Tooltip } from '@mui/material';
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
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToHorizontalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import { COLORS, DURATION, EASING } from '@/style/constants';
import { TOOL_CATALOG, TOOL_CATEGORIES } from '../types';
import type { PipelineTool, ToolName } from '../types';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const BarRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
});

const ActiveRow = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  height: 48,
  padding: '0 16px',
  gap: 8,
  flexShrink: 0,
}));

const PillsContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flex: 1,
  overflowX: 'auto',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
});

const ToolPill = styled(Chip)(({ theme }) => ({
  borderRadius: 16,
  height: 28,
  fontWeight: 500,
  fontSize: '0.75rem',
  '& .MuiChip-deleteIcon': {
    fontSize: 16,
    color: 'inherit',
    '&:hover': { color: theme.vars.palette.error.main },
  },
}));

const ExpandedSection = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: '8px 16px 12px',
  borderTop: '1px solid',
  borderColor: theme.vars.palette.divider,
}));

const CategoryRow = styled(Box)({
  marginBottom: 8,
});

const ToolChipsRow = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 4,
});

const AvailableToolChip = styled(Chip)(({ theme }) => ({
  borderRadius: 6,
  height: 28,
  cursor: 'pointer',
  fontSize: '0.75rem',
  fontWeight: 500,
  backgroundColor: 'transparent',
  border: '1px solid',
  borderColor: theme.vars.palette.divider,
  color: theme.vars.palette.text.secondary,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    borderColor: theme.vars.palette.secondary.main,
    color: theme.vars.palette.secondary.main,
    backgroundColor: 'rgba(0, 200, 215, 0.06)',
  },
}));

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  standard: COLORS.cyan,
  edge: COLORS.warningDk,
  ai: COLORS.red,
  quality: COLORS.successDk,
};

const camelCase = (s: string): string =>
  s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

// -----------------------------------------------------------------
// SortablePill sub-component
// -----------------------------------------------------------------

interface SortablePillProps {
  tool: PipelineTool;
  color: string;
  label: string;
  onRemove: (id: string) => void;
}

const SortablePill = ({ tool, color, label, onRemove }: SortablePillProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tool.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ToolPill
        label={label}
        size="small"
        onDelete={() => onRemove(tool.id)}
        deleteIcon={<CloseIcon />}
        sx={{
          borderColor: color,
          color,
          borderWidth: 1,
          borderStyle: 'solid',
          opacity: tool.enabled ? 1 : 0.5,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      />
    </div>
  );
};

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface PipelineBarProps {
  expanded: boolean;
  onToggleExpand: () => void;
  activePipeline: PipelineTool[];
  onAddTool: (tool: PipelineTool) => void;
  onRemoveTool: (toolId: string) => void;
  onReorder: (tools: PipelineTool[]) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const PipelineBar = ({
  expanded,
  onToggleExpand,
  activePipeline,
  onAddTool,
  onRemoveTool,
  onReorder,
}: PipelineBarProps) => {
  const { t } = useTranslation();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const activeToolNames = new Set(activePipeline.map((p) => p.name));

  const handleAddTool = (toolName: ToolName) => {
    const newTool: PipelineTool = {
      id: crypto.randomUUID(),
      name: toolName,
      params: {},
      enabled: true,
      condition: null,
    };
    onAddTool(newTool);
  };

  const getCategoryColor = (toolName: ToolName): string => {
    const def = TOOL_CATALOG.find((tc) => tc.name === toolName);
    return def ? (CATEGORY_COLORS[def.category] ?? COLORS.cyan) : COLORS.cyan;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = activePipeline.findIndex((t) => t.id === active.id);
    const newIndex = activePipeline.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(activePipeline, oldIndex, newIndex));
  };

  const sortableIds = activePipeline.map((t) => t.id);

  return (
    <BarRoot>
      {/* Active pipeline pills row */}
      <ActiveRow>
        <Typography variant="overline" color="text.secondary" sx={{ flexShrink: 0, mr: 1 }}>
          {t('design.pipeline.activePipeline')}
        </Typography>

        <PillsContainer>
          {activePipeline.length === 0 ? (
            <Typography variant="caption" color="text.disabled">
              {t('design.pipeline.noTools')}
            </Typography>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
                <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                  {activePipeline.map((tool) => (
                    <SortablePill
                      key={tool.id}
                      tool={tool}
                      color={getCategoryColor(tool.name)}
                      label={t(`design.tools.${camelCase(tool.name)}`)}
                      onRemove={onRemoveTool}
                    />
                  ))}
                </Box>
              </SortableContext>
            </DndContext>
          )}
        </PillsContainer>

        <Tooltip title={expanded ? t('design.pipeline.collapse') : t('design.pipeline.expand')}>
          <IconButton size="small" onClick={onToggleExpand} aria-label={t('design.pipeline.addTool')}>
            {expanded ? <ExpandLessIcon sx={{ fontSize: 20 }} /> : <ExpandMoreIcon sx={{ fontSize: 20 }} />}
          </IconButton>
        </Tooltip>
      </ActiveRow>

      {/* Expanded: available tools grouped by category */}
      {expanded && (
        <ExpandedSection>
          {TOOL_CATEGORIES.map(({ key, labelKey }) => {
            const tools = TOOL_CATALOG.filter((tc) => tc.category === key);
            return (
              <CategoryRow key={key}>
                <Typography variant="overline" color="text.secondary">
                  {t(labelKey)}
                </Typography>
                <ToolChipsRow>
                  {tools.map((tool) => {
                    const alreadyActive = activeToolNames.has(tool.name);
                    return (
                      <AvailableToolChip
                        key={tool.name}
                        label={t(tool.labelKey)}
                        size="small"
                        disabled={alreadyActive}
                        onClick={() => !alreadyActive && handleAddTool(tool.name)}
                        sx={alreadyActive ? { opacity: 0.4, pointerEvents: 'none' } : {}}
                      />
                    );
                  })}
                </ToolChipsRow>
              </CategoryRow>
            );
          })}
        </ExpandedSection>
      )}
    </BarRoot>
  );
};
