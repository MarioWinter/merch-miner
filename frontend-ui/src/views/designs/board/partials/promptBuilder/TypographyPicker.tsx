// PROJ-34 Phase 13e — Typography Adjectives slot picker.
// MUI Select over 6 fixed options + Custom… reveal + style-auto-default Chip
// when the current value matches the style's default (Appendix K). The
// ↺ reset icon re-applies the style-default; "dirty" tracking lives in the
// parent (Phase 13g) so style switches don't silently re-fill an overridden
// slot — see EC-28.

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
import { TYPOGRAPHY_OPTIONS } from '../../constants/slotOptions';

interface TypographyPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Style's auto-default (Appendix K row). Undefined when no style selected. */
  styleDefault?: string;
  /** Display label of the style currently driving the default (e.g. "Vintage Retro"). */
  styleLabel?: string;
  disabled?: boolean;
}

const CUSTOM_SENTINEL = '__custom__';
const EMPTY_SENTINEL = '__empty__';

const TypographyPicker = ({
  value,
  onChange,
  styleDefault,
  styleLabel,
  disabled = false,
}: TypographyPickerProps) => {
  const isPreset = useMemo(
    () => TYPOGRAPHY_OPTIONS.includes(value),
    [value],
  );
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
    <Stack spacing={1} data-testid="typography-picker">
      <Stack direction="row" alignItems="center" spacing={1}>
        <InputLabel shrink sx={{ flex: 1 }}>
          Typography
        </InputLabel>
        {matchesDefault && (
          <Chip
            size="small"
            color="secondary"
            variant="outlined"
            label={
              styleLabel ? `auto from ${styleLabel}` : 'auto from style'
            }
            data-testid="typography-auto-chip"
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
            inputProps={{ 'aria-label': 'Typography option' }}
          >
            <MenuItem value={EMPTY_SENTINEL}>
              <em>None — auto from style</em>
            </MenuItem>
            {TYPOGRAPHY_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
            <MenuItem value={CUSTOM_SENTINEL}>Custom…</MenuItem>
          </Select>
        </Box>
        {canReset && (
          <Tooltip
            title={
              styleDefault ? 'Reset to style default' : 'Clear typography'
            }
          >
            <IconButton
              size="small"
              onClick={handleReset}
              aria-label="Reset typography"
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
          placeholder="Describe the typography style…"
          disabled={disabled}
          inputProps={{ 'aria-label': 'Custom typography' }}
        />
      )}
    </Stack>
  );
};

export default TypographyPicker;
