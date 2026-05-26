// PROJ-34 Phase 8 — PresetBar for the renovated Builder dialog.
// Lifts the existing inline PresetBar logic out of PromptBuilderDialog into a
// reusable component, swapping `PromptPreset` for the new `BuilderPresetSummary`
// shape (per Phase-6 backend endpoint).

import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  TextField,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import type { BuilderPresetSummary } from '../../types/builder';

interface PresetBarProps {
  presets: BuilderPresetSummary[];
  selectedPresetId: string | null;
  onLoadPreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  onSavePreset: (name: string) => void;
}

const Bar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5, 3),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
}));

const PresetBar = ({
  presets,
  selectedPresetId,
  onLoadPreset,
  onDeletePreset,
  onSavePreset,
}: PresetBarProps) => {
  const [name, setName] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSavePreset(trimmed);
    setName('');
    setShowInput(false);
  };

  const handleDelete = () => {
    if (!selectedPresetId) return;
    if (window.confirm('Delete this preset?')) onDeletePreset(selectedPresetId);
  };

  return (
    <Bar>
      <TextField
        select
        size="small"
        value={selectedPresetId ?? ''}
        onChange={(e) => onLoadPreset(e.target.value)}
        label="Preset"
        sx={{ minWidth: 180, flex: 1, maxWidth: 280 }}
      >
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
        {presets.map((p) => (
          <MenuItem key={p.id} value={p.id}>
            {p.name}
          </MenuItem>
        ))}
      </TextField>

      {selectedPresetId && (
        <IconButton
          size="small"
          onClick={handleDelete}
          aria-label="Delete preset"
          sx={{ color: 'text.secondary' }}
        >
          <DeleteOutlineIcon sx={{ fontSize: 18 }} />
        </IconButton>
      )}

      {showInput ? (
        <>
          <TextField
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Preset name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setShowInput(false);
                setName('');
              }
            }}
            autoFocus
            sx={{ minWidth: 140 }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={handleSave}
            disabled={!name.trim()}
            sx={{ textTransform: 'none' }}
          >
            Save
          </Button>
          <Button
            size="small"
            onClick={() => {
              setShowInput(false);
              setName('');
            }}
            sx={{ color: 'text.secondary', textTransform: 'none' }}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button
          size="small"
          startIcon={<SaveOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={() => setShowInput(true)}
          sx={{ color: 'text.secondary', textTransform: 'none' }}
        >
          Save as Preset
        </Button>
      )}
    </Bar>
  );
};

export default PresetBar;
