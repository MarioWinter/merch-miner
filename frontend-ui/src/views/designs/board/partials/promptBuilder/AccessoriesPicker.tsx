// PROJ-34 Phase 13e — Accessories slot picker (multi-select with custom typed).
// MUI Autocomplete in `multiple={true} freeSolo={true}` mode over the 6 fixed
// ACCESSORIES_OPTIONS. Internally tracks a string[], emits the BuilderConfig
// shape via a `', '`-joined string so the backend renders cleanly into
// "The design features {value}." (Appendix J.3 row 5).

import { useMemo } from 'react';
import {
  Autocomplete,
  Chip,
  InputLabel,
  Stack,
  TextField,
} from '@mui/material';
import { ACCESSORIES_OPTIONS } from '../../constants/slotOptions';

interface AccessoriesPickerProps {
  /** Comma-joined string as stored on BuilderConfig.slots.accessories. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const SEPARATOR = ', ';

const splitValue = (value: string): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
};

const AccessoriesPicker = ({
  value,
  onChange,
  disabled = false,
}: AccessoriesPickerProps) => {
  const selectedValues = useMemo(() => splitValue(value), [value]);

  const handleChange = (_event: unknown, next: string[]) => {
    // Dedupe while preserving insertion order.
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const entry of next) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      unique.push(trimmed);
    }
    onChange(unique.join(SEPARATOR));
  };

  return (
    <Stack spacing={1} data-testid="accessories-picker">
      <InputLabel shrink>Accessories</InputLabel>
      <Autocomplete
        multiple
        freeSolo
        size="small"
        options={[...ACCESSORIES_OPTIONS]}
        value={selectedValues}
        onChange={handleChange}
        disabled={disabled}
        renderTags={(tagValues, getTagProps) =>
          tagValues.map((option, index) => {
            const { key, ...rest } = getTagProps({ index });
            return (
              <Chip
                key={key}
                size="small"
                variant="filled"
                color="secondary"
                label={option}
                {...rest}
              />
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={
              selectedValues.length === 0
                ? 'Pick presets or type your own…'
                : ''
            }
            inputProps={{
              ...params.inputProps,
              'aria-label': 'Accessories selection',
            }}
          />
        )}
      />
    </Stack>
  );
};

export default AccessoriesPicker;
