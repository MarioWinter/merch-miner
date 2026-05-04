import {
  Alert,
  Box,
  Button,
  Collapse,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import type { ResearchFilters, FilterKey } from '../types';
import RangeSliderFilter from './RangeSliderFilter';
import StarRatingFilter from './StarRatingFilter';

interface AdvancedOptionsPanelProps {
  open: boolean;
  isLive: boolean;
  filters: ResearchFilters;
  onFilterChange: <K extends keyof ResearchFilters>(key: K, value: ResearchFilters[K]) => void;
  onEnabledChange: (key: FilterKey, value: boolean) => void;
}

const PanelBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.vars.palette.background.paper,
  borderRadius: 12,
  border: `1px solid ${theme.vars.palette.divider}`,
  padding: theme.spacing(3),
}));

const AdvancedOptionsPanel = ({
  open,
  isLive,
  filters,
  onFilterChange,
  onEnabledChange,
}: AdvancedOptionsPanelProps) => (
  <Collapse in={open}>
    <PanelBox sx={{ mt: 2 }}>
      {isLive && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Most filters available in DB Research mode only. Hide Official Brands
          is active in Live mode.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left column: Range sliders (DB-only) */}
        <Grid
          size={{ xs: 12, md: 4 }}
          sx={isLive ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
        >
          <RangeSliderFilter
            label="BSR Range"
            value={[filters.bsr_min, filters.bsr_max]}
            min={1}
            max={500000}
            step={1000}
            onChange={([min, max]) => {
              onFilterChange('bsr_min', min);
              onFilterChange('bsr_max', max);
            }}
            formatValue={(v) => v.toLocaleString()}
          />

          <RangeSliderFilter
            label="Reviews"
            value={[filters.reviews_min, filters.reviews_max]}
            min={0}
            max={10000}
            step={100}
            onChange={([min, max]) => {
              onFilterChange('reviews_min', min);
              onFilterChange('reviews_max', max);
            }}
          />

          <RangeSliderFilter
            label="Price ($)"
            value={[filters.price_min, filters.price_max]}
            min={1}
            max={100}
            step={1}
            onChange={([min, max]) => {
              onFilterChange('price_min', min);
              onFilterChange('price_max', max);
            }}
            formatValue={(v) => `$${v}`}
          />
        </Grid>

        {/* Center column: Rating (DB-only) + Hide Official Brands (always active) */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={isLive ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <StarRatingFilter
              value={filters.rating_min}
              onChange={(v) => {
                onFilterChange('rating_min', v);
                onEnabledChange('rating_min', v > 0);
              }}
            />
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Official Brands
            </Typography>
            <Button
              fullWidth
              variant={filters.hide_official_brands ? 'contained' : 'outlined'}
              color={filters.hide_official_brands ? 'secondary' : 'inherit'}
              onClick={() => {
                const next = !filters.hide_official_brands;
                onFilterChange('hide_official_brands', next);
                onEnabledChange('hide_official_brands', next);
              }}
              aria-label="Toggle hide official brands"
            >
              {filters.hide_official_brands
                ? 'Official Brands Hidden'
                : 'Hide Official Brands'}
            </Button>
          </Box>
        </Grid>

        {/* Right column: Subcategory, Exclude Words, Date Range (DB-only) */}
        <Grid
          size={{ xs: 12, md: 4 }}
          sx={isLive ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
        >
          <TextField
            label="Subcategory"
            size="small"
            fullWidth
            value={filters.subcategory}
            onChange={(e) => {
              onFilterChange('subcategory', e.target.value);
              onEnabledChange('subcategory', !!e.target.value);
            }}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Exclude Words (comma-separated)"
            size="small"
            fullWidth
            value={filters.exclude_words}
            onChange={(e) => {
              onFilterChange('exclude_words', e.target.value);
              onEnabledChange('exclude_words', !!e.target.value);
            }}
            sx={{ mb: 2 }}
          />

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Date Range
            </Typography>
            <Stack direction="row" spacing={1}>
              <DatePicker
                label="From"
                value={filters.date_from ? dayjs(filters.date_from) : null}
                onChange={(v) => {
                  const val = v ? v.format('YYYY-MM-DD') : '';
                  onFilterChange('date_from', val);
                  onEnabledChange('date_from', !!val);
                }}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
              <DatePicker
                label="To"
                value={filters.date_to ? dayjs(filters.date_to) : null}
                onChange={(v) => {
                  const val = v ? v.format('YYYY-MM-DD') : '';
                  onFilterChange('date_to', val);
                  onEnabledChange('date_to', !!val);
                }}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Stack>
          </LocalizationProvider>
        </Grid>
      </Grid>
    </PanelBox>
  </Collapse>
);

export default AdvancedOptionsPanel;
