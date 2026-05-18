// PROJ-34 Phase 13e — Text Segmentation slot picker.
// MUI Select over 6 fixed options + final "Custom…" entry that reveals a
// free-text TextField. No style-auto-default for this slot (J.3 row 3:
// `style_auto_default: False`); the `styleDefault` prop is accepted for shape
// parity with TypographyPicker / MaterialPicker but never renders the chip.
// The reset (↺) icon clears the slot back to undefined.

import { useMemo, useState } from 'react';
import {
  Box,
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
import { TEXT_SEGMENTATION_OPTIONS } from '../../constants/slotOptions';

interface TextSegmentationPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Unused for this slot — kept for prop-shape symmetry with Typography/Material. */
  styleDefault?: string;
  disabled?: boolean;
}

const CUSTOM_SENTINEL = '__custom__';
const EMPTY_SENTINEL = '__empty__';

const TextSegmentationPicker = ({
  value,
  onChange,
  styleDefault,
  disabled = false,
}: TextSegmentationPickerProps) => {
  const isPreset = useMemo(
    () => TEXT_SEGMENTATION_OPTIONS.includes(value),
    [value],
  );
  // Local "I picked Custom but haven't typed yet" state — distinct from a real
  // empty value so we can show the TextField as soon as the user opens it.
  const [customMode, setCustomMode] = useState<boolean>(
    Boolean(value) && !isPreset,
  );

  const selectValue = value === ''
    ? EMPTY_SENTINEL
    : isPreset
      ? value
      : CUSTOM_SENTINEL;

  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    const next = event.target.value;
    if (next === CUSTOM_SENTINEL) {
      setCustomMode(true);
      // Don't wipe the existing custom text if the user re-selects Custom.
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
    // No style-default for this slot — reset clears to empty.
    onChange(styleDefault ?? '');
  };

  const canReset = value !== '' && value !== (styleDefault ?? '');

  return (
    <Stack spacing={1} data-testid="text-segmentation-picker">
      <InputLabel shrink>Text Segmentation</InputLabel>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Select
            fullWidth
            size="small"
            value={selectValue}
            onChange={handleSelectChange}
            disabled={disabled}
            displayEmpty
            inputProps={{ 'aria-label': 'Text segmentation option' }}
          >
            <MenuItem value={EMPTY_SENTINEL}>
              <em>None — auto from style</em>
            </MenuItem>
            {TEXT_SEGMENTATION_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
            <MenuItem value={CUSTOM_SENTINEL}>Custom…</MenuItem>
          </Select>
        </Box>
        {canReset && (
          <Tooltip title="Reset to default">
            <IconButton
              size="small"
              onClick={handleReset}
              aria-label="Reset text segmentation"
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
          placeholder="Describe how the slogan text is segmented…"
          disabled={disabled}
          inputProps={{ 'aria-label': 'Custom text segmentation' }}
        />
      )}
    </Stack>
  );
};

export default TextSegmentationPicker;
