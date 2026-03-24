import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import {
  MARKETPLACE_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  SORT_OPTIONS,
  type ResearchFilters,
} from '../types';

interface ControlsRowProps {
  isLive: boolean;
  filters: ResearchFilters;
  onFilterChange: <K extends keyof ResearchFilters>(key: K, value: ResearchFilters[K]) => void;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  activeFilterCount: number;
}

const ControlsRow = ({
  isLive,
  filters,
  onFilterChange,
  advancedOpen,
  onToggleAdvanced,
  activeFilterCount,
}: ControlsRowProps) => (
  <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
    <FormControl size="small" sx={{ minWidth: 160 }}>
      <InputLabel>Marketplace</InputLabel>
      <Select
        value={filters.marketplace}
        label="Marketplace"
        onChange={(e) => onFilterChange('marketplace', e.target.value)}
        aria-label="Select marketplace"
      >
        {MARKETPLACE_OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.flag} {opt.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>

    <FormControl size="small" sx={{ minWidth: 140 }}>
      <InputLabel>Product Type</InputLabel>
      <Select
        value={filters.product_type}
        label="Product Type"
        onChange={(e) => onFilterChange('product_type', e.target.value)}
        aria-label="Select product type"
      >
        {PRODUCT_TYPE_OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>

    {!isLive && (
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>Sort By</InputLabel>
        <Select
          value={filters.sort_by}
          label="Sort By"
          onChange={(e) => onFilterChange('sort_by', e.target.value)}
          aria-label="Sort results"
        >
          {SORT_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    )}

    <Box sx={{ flex: 1 }} />

    <Button
      variant="text"
      onClick={onToggleAdvanced}
      endIcon={advancedOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      sx={{ color: 'text.secondary' }}
      aria-label="Toggle advanced options"
    >
      Advanced Options{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
    </Button>
  </Stack>
);

export default ControlsRow;
