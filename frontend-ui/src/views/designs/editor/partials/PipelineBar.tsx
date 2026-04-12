import { useState } from 'react';
import { Box, Chip, Divider, Switch, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
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
import CloseIcon from '@mui/icons-material/Close';
import { COLORS, DURATION, EASING } from '@/style/constants';
import { TOOL_CATALOG, TOOL_CATEGORIES } from '../types';
import type { PipelineTool, ToolName } from '../types';
import { TOOL_ICON_MAP } from './ToolIcons';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const BarRoot = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '6px 16px',
  minHeight: 44,
  flexWrap: 'wrap',
});

const CategoryGroup = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
});

const CategoryLabel = styled(Typography)({
  fontSize: '0.5625rem',
  lineHeight: 1,
  letterSpacing: '0.08em',
  whiteSpace: 'nowrap',
  marginRight: 2,
});

const InactiveChip = styled(Chip)(({ theme }) => ({
  borderRadius: 16,
  height: 28,
  fontWeight: 500,
  fontSize: '0.75rem',
  padding: '0 10px',
  cursor: 'pointer',
  backgroundColor: 'transparent',
  border: '1px solid',
  borderColor: theme.vars.palette.divider,
  color: theme.vars.palette.text.secondary,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '& .MuiChip-icon': {
    fontSize: 14,
    marginLeft: 0,
    marginRight: 4,
    color: 'inherit',
  },
  '&:hover': {
    borderColor: 'var(--chip-cat-color)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
}));

const ActiveChip = styled(Chip)({
  borderRadius: 16,
  height: 28,
  fontWeight: 500,
  fontSize: '0.75rem',
  padding: '0 10px',
  border: '1px solid',
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '& .MuiChip-icon': {
    fontSize: 14,
    marginLeft: 0,
    marginRight: 4,
    color: 'inherit',
  },
  '& .MuiChip-deleteIcon': {
    fontSize: 14,
    color: 'inherit',
    opacity: 0,
    transition: `opacity ${DURATION.fast}ms ${EASING.standard}`,
    marginRight: -2,
    marginLeft: 2,
  },
  '&:hover': {
    filter: 'brightness(1.15)',
  },
  '&:hover .MuiChip-deleteIcon': {
    opacity: 1,
  },
});

const CategoryDivider = styled(Divider)({
  height: 24,
  alignSelf: 'center',
  margin: '0 4px',
});

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  standard: COLORS.cyan,
  edge: COLORS.warningDk,
  ai: COLORS.red,
};

const camelCase = (s: string): string =>
  s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

// -----------------------------------------------------------------
// SortableActiveChip sub-component
// -----------------------------------------------------------------

interface SortableActiveChipProps {
  tool: PipelineTool;
  color: string;
  label: string;
  tooltip: string;
  showTooltips: boolean;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

const SortableActiveChip = ({ tool, color, label, tooltip, showTooltips, onToggle, onRemove }: SortableActiveChipProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tool.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  const IconComponent = TOOL_ICON_MAP[tool.name];

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Tooltip title={showTooltips ? tooltip : ''} placement="bottom" arrow enterDelay={3000}>
        <ActiveChip
          icon={<IconComponent />}
          label={label}
          size="small"
          onDelete={(e) => {
            e.stopPropagation();
            onRemove(tool.id);
          }}
          deleteIcon={<CloseIcon />}
          onClick={() => onToggle(tool.id)}
          sx={{
            borderColor: color,
            color,
            backgroundColor: tool.enabled ? `${color}1F` : 'transparent',
            opacity: tool.enabled ? 1 : 0.45,
            cursor: isDragging ? 'grabbing' : 'pointer',
          }}
        />
      </Tooltip>
    </div>
  );
};

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface PipelineBarProps {
  activePipeline: PipelineTool[];
  onAddTool: (tool: PipelineTool) => void;
  onToggleTool: (toolId: string) => void;
  onRemoveTool: (toolId: string) => void;
  onReorder: (tools: PipelineTool[]) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const PipelineBar = ({
  activePipeline,
  onAddTool,
  onToggleTool,
  onRemoveTool,
  onReorder,
}: PipelineBarProps) => {
  const { t } = useTranslation();
  const [showTooltips, setShowTooltips] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const activeToolNames = new Set(activePipeline.map((p) => p.name));
  const activeToolMap = new Map(activePipeline.map((p) => [p.name, p]));

  const getCategoryColor = (category: string): string =>
    CATEGORY_COLORS[category] ?? COLORS.cyan;

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
          {TOOL_CATEGORIES.map(({ key, labelKey }, catIndex) => {
            const tools = TOOL_CATALOG.filter((tc) => tc.category === key);
            const catColor = getCategoryColor(key);
            return (
              <Box key={key} sx={{ display: 'contents' }}>
                {catIndex > 0 && <CategoryDivider orientation="vertical" flexItem />}
                <CategoryGroup>
                  <CategoryLabel variant="overline" sx={{ color: catColor }}>
                    {t(labelKey)}
                  </CategoryLabel>
                  {tools.map((toolDef) => {
                    const isActive = activeToolNames.has(toolDef.name);
                    const activeTool = activeToolMap.get(toolDef.name);
                    const label = t(`design.tools.${camelCase(toolDef.name)}`);
                    const tooltip = t(`design.tools.tooltip.${camelCase(toolDef.name)}`);
                    const IconComponent = TOOL_ICON_MAP[toolDef.name];

                    if (isActive && activeTool) {
                      return (
                        <SortableActiveChip
                          key={activeTool.id}
                          tool={activeTool}
                          color={catColor}
                          label={label}
                          tooltip={tooltip}
                          showTooltips={showTooltips}
                          onToggle={onToggleTool}
                          onRemove={onRemoveTool}
                        />
                      );
                    }

                    return (
                      <Tooltip key={toolDef.name} title={showTooltips ? tooltip : ''} placement="bottom" arrow enterDelay={3000}>
                        <InactiveChip
                          icon={<IconComponent />}
                          label={label}
                          size="small"
                          onClick={() => handleAddTool(toolDef.name)}
                          style={{ '--chip-cat-color': catColor } as React.CSSProperties}
                        />
                      </Tooltip>
                    );
                  })}
                </CategoryGroup>
              </Box>
            );
          })}
        </SortableContext>
      </DndContext>

      {/* Tooltip toggle — right end */}
      <Tooltip title={t('design.pipeline.toggleTooltips')} placement="bottom" arrow>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <HelpOutlineIcon sx={{ fontSize: 14, color: 'text.disabled', mr: 0.25 }} />
          <Switch
            size="small"
            checked={showTooltips}
            onChange={(_, checked) => setShowTooltips(checked)}
            aria-label={t('design.pipeline.toggleTooltips')}
          />
        </Box>
      </Tooltip>
    </BarRoot>
  );
};
