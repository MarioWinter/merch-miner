import { Stack, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import type { DateRange } from '../types';

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}

const DateRangePicker = ({ dateRange, onChange }: DateRangePickerProps) => {
  const { t } = useTranslation();

  const fromValue = dateRange?.date_from ? dayjs(dateRange.date_from) : null;
  const toValue = dateRange?.date_to ? dayjs(dateRange.date_to) : null;

  const handleFromChange = (value: Dayjs | null) => {
    if (!value) {
      onChange(undefined);
      return;
    }
    onChange({
      date_from: value.format('YYYY-MM-DD'),
      date_to: dateRange?.date_to ?? dayjs().format('YYYY-MM-DD'),
    });
  };

  const handleToChange = (value: Dayjs | null) => {
    if (!value) {
      onChange(undefined);
      return;
    }
    onChange({
      date_from: dateRange?.date_from ?? value.subtract(3, 'month').format('YYYY-MM-DD'),
      date_to: value.format('YYYY-MM-DD'),
    });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="body2" color="text.secondary">
          {t('dashboard.analytics.dateRange')}
        </Typography>
        <DatePicker
          label={t('dashboard.analytics.from')}
          value={fromValue}
          onChange={handleFromChange}
          maxDate={toValue ?? undefined}
          slotProps={{
            textField: { size: 'small', sx: { width: 160 } },
          }}
        />
        <DatePicker
          label={t('dashboard.analytics.to')}
          value={toValue}
          onChange={handleToChange}
          minDate={fromValue ?? undefined}
          maxDate={dayjs()}
          slotProps={{
            textField: { size: 'small', sx: { width: 160 } },
          }}
        />
      </Stack>
    </LocalizationProvider>
  );
};

export default DateRangePicker;
