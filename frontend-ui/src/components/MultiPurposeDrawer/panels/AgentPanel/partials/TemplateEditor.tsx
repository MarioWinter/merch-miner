import { useState, useCallback, useMemo } from 'react';
import {
  Stack,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  IconButton,
  Chip,
  Skeleton,
  Box,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useListTemplatesQuery,
  useCreateTemplateMutation,
  useDeleteTemplateMutation,
} from '@/store/agentSlice';
import type { AgentType, WorkflowStep } from '../types';
import SortableStepRow from './SortableStepRow';

const AGENT_TYPES: AgentType[] = [
  'research',
  'ideation',
  'design',
  'listing',
  'publishing',
  'search',
];

interface IndexedStep extends WorkflowStep {
  _id: string;
}

const TemplateEditor = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { data: templates, isLoading } = useListTemplatesQuery();
  const [createTemplate] = useCreateTemplateMutation();
  const [deleteTemplate] = useDeleteTemplateMutation();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [steps, setSteps] = useState<IndexedStep[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const stepIds = useMemo(() => steps.map((s) => s._id), [steps]);

  const addStep = useCallback(() => {
    setSteps((prev) => [
      ...prev,
      {
        _id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        agent_type: 'research',
        action: '',
        description: '',
      },
    ]);
  }, []);

  const updateStep = useCallback(
    (idx: number, field: keyof WorkflowStep, value: string) => {
      setSteps((prev) =>
        prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
      );
    },
    [],
  );

  const removeStep = useCallback((idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSteps((prev) => {
      const oldIndex = prev.findIndex((s) => s._id === active.id);
      const newIndex = prev.findIndex((s) => s._id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !key.trim() || steps.length === 0) return;
    try {
      const stepsPayload: WorkflowStep[] = steps.map(({ _id: _omit, ...rest }) => {
        void _omit;
        return rest;
      });
      await createTemplate({ name, key, steps: stepsPayload }).unwrap();
      enqueueSnackbar(t('agent.templates.saved'), { variant: 'success' });
      setName('');
      setKey('');
      setSteps([]);
      setCreating(false);
    } catch {
      enqueueSnackbar(t('agent.templates.saveError'), { variant: 'error' });
    }
  }, [name, key, steps, createTemplate, enqueueSnackbar, t]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteTemplate(id).unwrap();
        enqueueSnackbar(t('agent.templates.deleted'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('agent.templates.deleteError'), { variant: 'error' });
      }
    },
    [deleteTemplate, enqueueSnackbar, t],
  );

  if (isLoading) {
    return (
      <Stack gap={1} sx={{ p: 2 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={48} />
        ))}
      </Stack>
    );
  }

  return (
    <Stack gap={1.5} sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2">{t('agent.templates.title')}</Typography>
        <IconButton
          size="small"
          onClick={() => setCreating(true)}
          aria-label={t('agent.templates.add')}
        >
          <AddIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Stack>

      {creating && (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Stack gap={1}>
              <TextField
                size="small"
                placeholder={t('agent.templates.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
              />
              <TextField
                size="small"
                placeholder={t('agent.templates.keyPlaceholder')}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                fullWidth
              />

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
                  <Stack gap={0.5}>
                    {steps.map((step, idx) => (
                      <SortableStepRow
                        key={step._id}
                        id={step._id}
                        step={step}
                        agentTypes={AGENT_TYPES}
                        onUpdate={(field, value) => updateStep(idx, field, value)}
                        onRemove={() => removeStep(idx)}
                      />
                    ))}
                  </Stack>
                </SortableContext>
              </DndContext>

              <Button
                size="small"
                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                onClick={addStep}
              >
                {t('agent.templates.addStep')}
              </Button>
              <Stack direction="row" gap={0.5} justifyContent="flex-end">
                <Button size="small" onClick={() => setCreating(false)}>
                  {t('agent.templates.cancel')}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleCreate}
                  disabled={!name.trim() || !key.trim() || steps.length === 0}
                >
                  {t('agent.templates.save')}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {(templates ?? []).length === 0 && !creating && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('agent.templates.empty')}
          </Typography>
        </Box>
      )}

      {(templates ?? []).map((tpl) => (
        <Card key={tpl.id} variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {tpl.name}
                  {tpl.is_system && (
                    <Chip
                      label="System"
                      size="small"
                      sx={{ ml: 0.5, height: 18, fontSize: '0.6875rem' }}
                    />
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {tpl.steps.map((s) => s.description || s.action).join(' → ')}
                </Typography>
              </Box>
              {!tpl.is_system && (
                <Tooltip title={t('agent.templates.delete')}>
                  <IconButton size="small" onClick={() => handleDelete(tpl.id)}>
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};

export default TemplateEditor;
