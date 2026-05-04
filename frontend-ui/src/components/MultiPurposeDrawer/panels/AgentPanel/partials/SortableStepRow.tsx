import { Stack, IconButton, MenuItem, Select, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import type { AgentType, WorkflowStep } from '../types';

const StepRoot = styled(Stack, {
  shouldForwardProp: (p) => p !== '$dragging',
})<{ $dragging?: boolean }>(({ theme, $dragging }) => ({
  flexDirection: 'row',
  gap: theme.spacing(0.5),
  alignItems: 'center',
  padding: theme.spacing(0.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: $dragging ? theme.vars.palette.action.hover : 'transparent',
  opacity: $dragging ? 0.6 : 1,
}));

const DragHandle = styled('span')({
  display: 'flex',
  alignItems: 'center',
  cursor: 'grab',
  touchAction: 'none',
  '&:active': { cursor: 'grabbing' },
});

interface SortableStepRowProps {
  id: string;
  step: WorkflowStep;
  agentTypes: AgentType[];
  onUpdate: (field: keyof WorkflowStep, value: string) => void;
  onRemove: () => void;
}

const SortableStepRow = ({
  id,
  step,
  agentTypes,
  onUpdate,
  onRemove,
}: SortableStepRowProps) => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <StepRoot ref={setNodeRef} style={style} $dragging={isDragging}>
      <DragHandle
        {...attributes}
        {...listeners}
        aria-label={t('agent.templates.dragHandle')}
        role="button"
      >
        <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
      </DragHandle>
      <Select
        size="small"
        value={step.agent_type}
        onChange={(e) => onUpdate('agent_type', e.target.value)}
        sx={{ minWidth: 110 }}
      >
        {agentTypes.map((at) => (
          <MenuItem key={at} value={at}>
            {at}
          </MenuItem>
        ))}
      </Select>
      <TextField
        size="small"
        placeholder={t('agent.templates.actionPlaceholder')}
        value={step.action}
        onChange={(e) => onUpdate('action', e.target.value)}
        sx={{ flex: 1 }}
      />
      <IconButton
        size="small"
        onClick={onRemove}
        aria-label={t('agent.templates.removeStep')}
      >
        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </StepRoot>
  );
};

export default SortableStepRow;
