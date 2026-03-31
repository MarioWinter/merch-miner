import { useState } from 'react';
import {
  Box,
  Select,
  MenuItem,
  IconButton,
  TextField,
  Tooltip,
  Typography,
  CircularProgress,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import SaveIcon from '@mui/icons-material/Save';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  useListPipelinesQuery,
  useCreatePipelineMutation,
  useDeletePipelineMutation,
} from '@/store/designSlice';
import type { PipelineTool, DesignPipeline } from '../types';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const PresetRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

const PresetActions = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const SaveRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface PipelinePresetDropdownProps {
  activePipeline: PipelineTool[];
  onLoadPreset: (tools: PipelineTool[]) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const PipelinePresetDropdown = ({
  activePipeline,
  onLoadPreset,
}: PipelinePresetDropdownProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const { data: pipelines = [], isLoading } = useListPipelinesQuery();
  const [createPipeline, { isLoading: isSaving }] = useCreatePipelineMutation();
  const [deletePipeline, { isLoading: isDeleting }] = useDeletePipelineMutation();

  const [selectedId, setSelectedId] = useState<string>('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [presetName, setPresetName] = useState('');

  const handleSelect = (pipelineId: string) => {
    setSelectedId(pipelineId);
    const pipeline = pipelines.find((p: DesignPipeline) => p.id === pipelineId);
    if (pipeline) {
      onLoadPreset(pipeline.tools);
    }
  };

  const handleSave = async () => {
    const name = presetName.trim();
    if (!name || activePipeline.length === 0) return;
    try {
      await createPipeline({ name, tools: activePipeline, is_preset: true }).unwrap();
      enqueueSnackbar(t('design.pipeline.presetSaved'), { variant: 'success' });
      setPresetName('');
      setShowSaveInput(false);
    } catch {
      enqueueSnackbar(t('design.pipeline.presetSaveError'), { variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await deletePipeline(selectedId).unwrap();
      enqueueSnackbar(t('design.pipeline.presetDeleted'), { variant: 'success' });
      setSelectedId('');
    } catch {
      enqueueSnackbar(t('design.pipeline.presetDeleteError'), { variant: 'error' });
    }
  };

  return (
    <PresetRoot>
      <PresetActions>
        <Select
          size="small"
          displayEmpty
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value as string)}
          sx={{ flex: 1, height: 32, fontSize: '0.8125rem' }}
          disabled={isLoading}
          aria-label={t('design.pipeline.presets')}
        >
          <MenuItem value="" disabled>
            <Typography variant="body2" color="text.disabled">
              {isLoading ? t('design.pipeline.presets') : t('design.pipeline.loadPreset')}
            </Typography>
          </MenuItem>
          {pipelines.map((p: DesignPipeline) => (
            <MenuItem key={p.id} value={p.id}>
              <Typography variant="body2">{p.name}</Typography>
            </MenuItem>
          ))}
          {!isLoading && pipelines.length === 0 && (
            <MenuItem disabled>
              <Typography variant="body2" color="text.disabled">
                {t('design.pipeline.noPresets')}
              </Typography>
            </MenuItem>
          )}
        </Select>

        <Tooltip title={t('design.pipeline.savePreset')}>
          <span>
            <IconButton
              size="small"
              onClick={() => setShowSaveInput((p) => !p)}
              disabled={activePipeline.length === 0}
              aria-label={t('design.pipeline.savePreset')}
            >
              <SaveIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={t('design.pipeline.deletePreset')}>
          <span>
            <IconButton
              size="small"
              onClick={handleDelete}
              disabled={!selectedId || isDeleting}
              color="error"
              aria-label={t('design.pipeline.deletePreset')}
            >
              {isDeleting ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </PresetActions>

      {showSaveInput && (
        <SaveRow>
          <TextField
            size="small"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder={t('design.pipeline.presetName')}
            slotProps={{ input: { sx: { fontSize: '0.8125rem', height: 32 } } }}
            sx={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            autoFocus
          />
          <Tooltip title={t('design.pipeline.savePreset')}>
            <span>
              <IconButton
                size="small"
                onClick={handleSave}
                disabled={!presetName.trim() || isSaving}
                color="secondary"
                aria-label={t('design.pipeline.savePreset')}
              >
                {isSaving ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <SaveIcon sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </SaveRow>
      )}
    </PresetRoot>
  );
};
