// PROJ-34 Phase 8 — text-warp dropdown (4 options + None).

import { MenuItem, TextField } from '@mui/material';
import { WARP_LIBRARY } from '../../constants/styleLibrary';

interface WarpPickerProps {
  value: string | null;
  onChange: (slug: string | null) => void;
}

const WarpPicker = ({ value, onChange }: WarpPickerProps) => (
  <TextField
    select
    size="small"
    label="Text warp"
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value ? e.target.value : null)}
    sx={{ width: 240 }}
  >
    <MenuItem value="">
      <em>None</em>
    </MenuItem>
    {WARP_LIBRARY.map((warp) => (
      <MenuItem key={warp.slug} value={warp.slug}>
        {warp.label}
      </MenuItem>
    ))}
  </TextField>
);

export default WarpPicker;
