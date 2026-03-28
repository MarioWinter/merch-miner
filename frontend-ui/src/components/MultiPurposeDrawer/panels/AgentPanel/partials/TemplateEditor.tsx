import { useState, useCallback } from 'react';
import {
  Stack,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  IconButton,
  Chip,
  MenuItem,
  Select,
  Skeleton,
  Box,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useTranslation } from 'react-i18next';
import {
  useListTemplatesQuery,
  useCreateTemplateMutation,
  useDeleteTemplateMutation,
} from '@/store/agentSlice';
import type { AgentType, WorkflowStep } from '../types';

const AGENT_TYPES: AgentType[] = [
  'research',
  'ideation',
  'design',
  'listing',
  'publishing',
  'search',
];

const TemplateEditor = () => {
  const { t } = useTranslation();
  const { data: templates, isLoading } = useListTemplatesQuery();
  const [createTemplate] = useCreateTemplateMutation();
  const [deleteTemplate] = useDeleteTemplateMutation();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);

  const addStep = useCallback(() => {
    setSteps((prev) => [
      ...prev,
      { agent_type: 'research', action: '', description: '' },
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

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !key.trim() || steps.length === 0) return;
    await createTemplate({ name, key, steps });
    setName('');
    setKey('');
    setSteps([]);
    setCreating(false);
  }, [name, key, steps, createTemplate]);

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
        <Typography variant="subtitle2">
          {t('agent.templates.title')}
        </Typography>
        <IconButton size="small" onClick={() => setCreating(true)}>
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
              {steps.map((step, idx) => (
                <Stack key={idx} direction="row" gap={0.5} alignItems="center">
                  <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  <Select
                    size="small"
                    value={step.agent_type}
                    onChange={(e) =>
                      updateStep(idx, 'agent_type', e.target.value)
                    }
                    sx={{ minWidth: 100 }}
                  >
                    {AGENT_TYPES.map((at) => (
                      <MenuItem key={at} value={at}>
                        {at}
                      </MenuItem>
                    ))}
                  </Select>
                  <TextField
                    size="small"
                    placeholder={t('agent.templates.actionPlaceholder')}
                    value={step.action}
                    onChange={(e) => updateStep(idx, 'action', e.target.value)}
                    sx={{ flex: 1 }}
                  />
                  <IconButton size="small" onClick={() => removeStep(idx)}>
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              ))}
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
                  disabled={!name.trim() || steps.length === 0}
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
                  {tpl.steps.map((s) => s.description || s.action).join(' \u2192 ')}
                </Typography>
              </Box>
              {!tpl.is_system && (
                <Tooltip title={t('agent.templates.delete')}>
                  <IconButton size="small" onClick={() => deleteTemplate(tpl.id)}>
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
