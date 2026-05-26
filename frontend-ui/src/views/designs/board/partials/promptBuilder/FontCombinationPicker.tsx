// PROJ-34 Phase 13l — Font Combination slot picker.
// MUI Select over 8 fixed multi-font hierarchy presets + Custom… reveal + ↺
// reset to empty. Unlike TypographyPicker there is no style-auto-default
// (per backend resolver — font_combination has no style-level default).
// When set, this slot silences typography_adjectives server-side so the
// helper text below the picker explains the override behavior.

import { useMemo, useState } from 'react';
import {
  Box,
  FormHelperText,
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
import { FONT_COMBINATION_OPTIONS } from '../../constants/slotOptions';

interface FontCombinationPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const CUSTOM_SENTINEL = '__custom__';
const EMPTY_SENTINEL = '__empty__';

const FontCombinationPicker = ({
  value,
  onChange,
  disabled = false,
}: FontCombinationPickerProps) => {
  const isPreset = useMemo(
    () => FONT_COMBINATION_OPTIONS.some((o) => o.prompt_text === value),
    [value],
  );
  const [customMode, setCustomMode] = useState<boolean>(
    Boolean(value) && !isPreset,
  );

  const selectValue =
    value === '' ? EMPTY_SENTINEL : isPreset ? value : CUSTOM_SENTINEL;

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
    onChange('');
  };

  const canReset = value !== '';

  return (
    <Stack spacing={1} data-testid="font-combination-picker">
      <InputLabel shrink>Font Combination</InputLabel>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Select
            fullWidth
            size="small"
            value={selectValue}
            onChange={handleSelectChange}
            disabled={disabled}
            displayEmpty
            inputProps={{ 'aria-label': 'Font combination option' }}
          >
            <MenuItem value={EMPTY_SENTINEL}>
              <em>None — single font</em>
            </MenuItem>
            {FONT_COMBINATION_OPTIONS.map((option) => (
              <MenuItem key={option.id} value={option.prompt_text}>
                {option.ui_label}
              </MenuItem>
            ))}
            <MenuItem value={CUSTOM_SENTINEL}>Custom…</MenuItem>
          </Select>
        </Box>
        {canReset && (
          <Tooltip title="Clear font combination">
            <IconButton
              size="small"
              onClick={handleReset}
              aria-label="Reset font combination"
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
          placeholder="Describe the font combination — e.g. headline serif + script accent + small sans subtitle"
          disabled={disabled}
          inputProps={{ 'aria-label': 'Custom font combination' }}
        />
      )}
      <FormHelperText>
        Sets a multi-font hierarchy. Replaces the single-font Typography selection.
      </FormHelperText>
    </Stack>
  );
};

export default FontCombinationPicker;
