// PROJ-34 Phase 13e — Material / Texture slot picker.
// Same pattern as TypographyPicker: MUI Select over 6 fixed options + Custom…
// reveal + style-auto-default Chip + ↺ reset to the style-default. Parent
// tracks the per-slot dirty flag (EC-28); this component is purely
// presentational.

import { useMemo, useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  type SelectChangeEvent,
} from '@mui/material';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import { MATERIAL_OPTIONS } from '../../constants/slotOptions';

interface MaterialPickerProps {
  value: string;
  onChange: (value: string) => void;
  styleDefault?: string;
  styleLabel?: string;
  disabled?: boolean;
}

const CUSTOM_SENTINEL = '__custom__';
const EMPTY_SENTINEL = '__empty__';

const MaterialPicker = ({
  value,
  onChange,
  styleDefault,
  styleLabel,
  disabled = false,
}: MaterialPickerProps) => {
  const isPreset = useMemo(() => MATERIAL_OPTIONS.includes(value), [value]);
  const [customMode, setCustomMode] = useState<boolean>(
    Boolean(value) && !isPreset,
  );

  const selectValue = value === ''
    ? EMPTY_SENTINEL
    : isPreset
      ? value
      : CUSTOM_SENTINEL;

  const matchesDefault =
    styleDefault !== undefined && value !== '' && value === styleDefault;

  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    const next = event.target.value;
    if (next === CUSTOM_SENTINEL) {
      setCustomMode(true);
      if (isPreset) onChange('');
      return;
    }
    if (next === EMPTY_SENTINEL) {
      setCustomMode(false);
      onChange('');
      return;
    }
    setCustomMode(false);
    onChange(next);
  };

  const handleReset = () => {
    setCustomMode(false);
    onChange(styleDefault ?? '');
  };

  const canReset =
    styleDefault !== undefined ? value !== styleDefault : value !== '';

  return (
    <Stack spacing={1} data-testid="material-picker">
      <Stack direction="row" alignItems="center" spacing={1}>
        <InputLabel shrink sx={{ flex: 1 }}>
          Material / Texture
        </InputLabel>
        {matchesDefault && (
          <Chip
            size="small"
            color="secondary"
            variant="outlined"
            label={
              styleLabel ? `auto from ${styleLabel}` : 'auto from style'
            }
            data-testid="material-auto-chip"
          />
        )}
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Select
            fullWidth
            size="small"
            value={selectValue}
            onChange={handleSelectChange}
            disabled={disabled}
            displayEmpty
            inputProps={{ 'aria-label': 'Material option' }}
          >
            <MenuItem value={EMPTY_SENTINEL}>
              <em>None — auto from style</em>
            </MenuItem>
            {MATERIAL_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
            <MenuItem value={CUSTOM_SENTINEL}>Custom…</MenuItem>
          </Select>
        </Box>
        {canReset && (
          <Tooltip
            title={styleDefault ? 'Reset to style default' : 'Clear material'}
          >
            <IconButton
              size="small"
              onClick={handleReset}
              aria-label="Reset material"
            >
              <RestartAltRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      {customMode && (
        <TextField
          fullWidth
          size="small"
          multiline
          minRows={2}
          maxRows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Describe the material/texture…"
          disabled={disabled}
          inputProps={{ 'aria-label': 'Custom material' }}
        />
      )}
    </Stack>
  );
};

export default MaterialPicker;
