import { Slider, Switch, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

interface RangeSliderFilterProps {
  label: string;
  value: [number, number];
  min: number;
  max: number;
  step: number;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onChange: (value: [number, number]) => void;
  formatValue?: (v: number) => string;
}

const FilterWrapper = styled(Stack)(({ theme }) => ({
  padding: theme.spacing(1.5, 0),
}));

const RangeSliderFilter = ({
  label,
  value,
  min,
  max,
  step,
  enabled,
  onEnabledChange,
  onChange,
  formatValue = (v) => v.toLocaleString(),
}: RangeSliderFilterProps) => {
  const handleChange = (_: Event, newValue: number | number[]) => {
    onChange(newValue as [number, number]);
  };

  return (
    <FilterWrapper spacing={1}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Switch
          size="small"
          checked={enabled}
          onChange={(_, checked) => onEnabledChange(checked)}
          aria-label={`Enable ${label} filter`}
        />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: 'auto' }}
        >
          {formatValue(value[0])} - {formatValue(value[1])}
        </Typography>
      </Stack>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={!enabled}
        onChange={handleChange}
        valueLabelDisplay="auto"
        valueLabelFormat={formatValue}
        sx={{ opacity: enabled ? 1 : 0.5 }}
        aria-label={label}
      />
    </FilterWrapper>
  );
};

export default RangeSliderFilter;
