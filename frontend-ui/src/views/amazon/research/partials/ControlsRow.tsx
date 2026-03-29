import React from 'react';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  ListItemIcon,
  ListItemText,
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
  LIVE_SORT_OPTIONS,
  type ResearchFilters,
  type SortOption,
} from '../types';
import {
  TShirtIcon,
  PremiumShirtIcon,
  ComfortColorsIcon,
  VNeckIcon,
  LongSleeveIcon,
  RaglanIcon,
  SweatshirtIcon,
  HoodieIcon,
  PerformancePoloIcon,
  ZipHoodieIcon,
  PopSocketIcon,
  PhoneCaseIcon,
  ToteBagIcon,
  TumblerIcon,
  CeramicMugIcon,
  TankTopIcon,
} from './ProductTypeIcons';
import type { SvgIconProps } from '@mui/material/SvgIcon';

const PRODUCT_TYPE_ICON_MAP: Record<string, (props: SvgIconProps) => React.ReactElement> = {
  t_shirt: TShirtIcon,
  premium_shirt: PremiumShirtIcon,
  comfort_colors: ComfortColorsIcon,
  v_neck: VNeckIcon,
  long_sleeve: LongSleeveIcon,
  raglan: RaglanIcon,
  sweatshirt: SweatshirtIcon,
  hoodie: HoodieIcon,
  performance_polo: PerformancePoloIcon,
  zip_hoodie: ZipHoodieIcon,
  popsocket: PopSocketIcon,
  phone_case: PhoneCaseIcon,
  tote_bag: ToteBagIcon,
  tumbler: TumblerIcon,
  ceramic_mug: CeramicMugIcon,
  tank_top: TankTopIcon,
};

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
}: ControlsRowProps) => {
  const sortOptions: SortOption[] = isLive ? LIVE_SORT_OPTIONS : SORT_OPTIONS;
  const sortValue = isLive ? filters.live_sort_by : filters.sort_by;
  const sortKey: keyof ResearchFilters = isLive ? 'live_sort_by' : 'sort_by';

  return (
    <>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Marketplace</InputLabel>
          <Select
            value={filters.marketplace}
            label="Marketplace"
            onChange={(e) => onFilterChange('marketplace', e.target.value)}
            renderValue={(value) => {
              const mp = MARKETPLACE_OPTIONS.find((m) => m.value === value);
              return mp ? `${mp.flag} ${mp.label}` : value;
            }}
            aria-label="Select marketplace"
          >
            {MARKETPLACE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.flag} {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Product Type</InputLabel>
          <Select
            value={filters.product_type}
            label="Product Type"
            onChange={(e) => onFilterChange('product_type', e.target.value)}
            renderValue={(value) => {
              const pt = PRODUCT_TYPE_OPTIONS.find((p) => p.value === value);
              const IconComp = PRODUCT_TYPE_ICON_MAP[value];
              return (
                <Stack direction="row" alignItems="center" spacing={1}>
                  {IconComp && <IconComp sx={{ fontSize: 18 }} />}
                  <span>{pt ? pt.label : value}</span>
                </Stack>
              );
            }}
            aria-label="Select product type"
          >
            {PRODUCT_TYPE_OPTIONS.map((opt) => {
              const IconComponent = PRODUCT_TYPE_ICON_MAP[opt.value];
              return (
                <MenuItem key={opt.value} value={opt.value}>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    {IconComponent && <IconComponent sx={{ fontSize: 18 }} />}
                  </ListItemIcon>
                  <ListItemText>{opt.label}</ListItemText>
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Sort By</InputLabel>
          <Select
            value={sortValue}
            label="Sort By"
            onChange={(e) => onFilterChange(sortKey, e.target.value)}
            renderValue={(value) => {
              const opt = sortOptions.find((o) => o.value === value);
              if (!opt) return <span>Sort</span>;
              const SortIconComp = opt.icon;
              return (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <SortIconComp sx={{ fontSize: 18 }} />
                  <span>{opt.label}</span>
                </Stack>
              );
            }}
            aria-label="Sort results"
          >
            {sortOptions.map((opt) => {
              const SortIconComp = opt.icon;
              return (
                <MenuItem key={opt.value} value={opt.value}>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <SortIconComp sx={{ fontSize: 18 }} />
                  </ListItemIcon>
                  <ListItemText>{opt.label}</ListItemText>
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>

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
    </>
  );
};

export default ControlsRow;
