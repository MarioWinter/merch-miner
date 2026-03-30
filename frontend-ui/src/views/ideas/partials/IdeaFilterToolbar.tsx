import {
  Autocomplete,
  Badge,
  Box,
  Button,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { COLORS } from '@/style/constants';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useTranslation } from 'react-i18next';
import { useListNichesQuery } from '@/store/nicheSlice';
import type { SelectChangeEvent } from '@mui/material';
import type { UseIdeaFiltersReturn } from '../hooks/useIdeaFilters';
import type { IdeaStatus, SignalType, IdeaOrdering } from '../types';
import { IdeaFilterTemplateDropdown } from './IdeaFilterTemplateDropdown';

interface IdeaFilterToolbarProps {
  filterState: UseIdeaFiltersReturn;
}

const ToolbarRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: `${theme.spacing(1.5)} 0`,
}));

const FilterSelect = styled(Select)(({ theme }) => ({
  minWidth: 140,
  height: 36,
  fontSize: '0.8125rem',
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: alpha(COLORS.ink, 0.18),
    ...theme.applyStyles('dark', {
      borderColor: alpha(COLORS.white, 0.12),
    }),
  },
  '& .MuiSelect-select': {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
}));

const ClearButton = styled(Button)(({ theme }) => ({
  color: theme.vars.palette.text.secondary,
  fontSize: '0.8125rem',
  fontWeight: 500,
  padding: `${theme.spacing(0.5)} ${theme.spacing(1.5)}`,
  minWidth: 'auto',
  '&:hover': {
    color: theme.vars.palette.text.primary,
    backgroundColor: alpha(COLORS.white, 0.04),
    ...theme.applyStyles('light', {
      backgroundColor: alpha(COLORS.ink, 0.04),
    }),
  },
}));

const STATUS_OPTIONS: { value: IdeaStatus | ''; labelKey: string }[] = [
  { value: '', labelKey: 'ideas.filter.allStatuses' },
  { value: 'pending', labelKey: 'ideas.status.pending' },
  { value: 'approved', labelKey: 'ideas.status.approved' },
  { value: 'rejected', labelKey: 'ideas.status.rejected' },
  { value: 'for_review', labelKey: 'ideas.status.for_review' },
];

const SIGNAL_OPTIONS: { value: SignalType | ''; labelKey: string }[] = [
  { value: '', labelKey: 'ideas.filter.allSignals' },
  { value: 'self', labelKey: 'ideas.signal.self' },
  { value: 'other', labelKey: 'ideas.signal.other' },
];

const ORDERING_OPTIONS: { value: IdeaOrdering | ''; labelKey: string }[] = [
  { value: '-created_at', labelKey: 'ideas.filter.ordering_newest' },
  { value: 'created_at', labelKey: 'ideas.filter.ordering_oldest' },
  { value: 'slogan_text', labelKey: 'ideas.filter.ordering_text_asc' },
  { value: '-slogan_text', labelKey: 'ideas.filter.ordering_text_desc' },
];

export const IdeaFilterToolbar = ({ filterState }: IdeaFilterToolbarProps) => {
  const { t } = useTranslation();
  const { filters, setNicheId, setStatus, setSignalType, setOrdering, resetFilters, activeFilterCount } = filterState;

  const { data: nichesData } = useListNichesQuery({ page_size: 200 });
  const niches = nichesData?.results ?? [];
  const selectedNiche = niches.find((n) => n.id === filters.niche_id) ?? null;

  const handleStatusChange = (e: SelectChangeEvent<unknown>) =>
    setStatus(e.target.value as IdeaStatus | '');

  const handleSignalChange = (e: SelectChangeEvent<unknown>) =>
    setSignalType(e.target.value as SignalType | '');

  const handleOrderingChange = (e: SelectChangeEvent<unknown>) =>
    setOrdering(e.target.value as IdeaOrdering | '');

  return (
    <ToolbarRoot role="search" aria-label={t('ideas.filter.allNiches')}>
      <IdeaFilterTemplateDropdown filterState={filterState} />

      <Autocomplete
        size="small"
        options={niches}
        getOptionLabel={(option) => option.name}
        value={selectedNiche}
        onChange={(_e, val) => setNicheId(val?.id ?? '')}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={t('ideas.filter.allNiches')}
            slotProps={{
              input: {
                ...params.InputProps,
                'aria-label': t('ideas.filter.allNiches'),
              },
            }}
          />
        )}
        sx={{
          width: 240,
          '& .MuiInputBase-root': { height: 36, fontSize: '0.8125rem' },
        }}
      />

      <FilterSelect
        size="small"
        value={filters.status}
        onChange={handleStatusChange}
        displayEmpty
        aria-label={t('ideas.filter.allStatuses')}
      >
        {STATUS_OPTIONS.map(({ value, labelKey }) => (
          <MenuItem key={value} value={value}>
            {t(labelKey)}
          </MenuItem>
        ))}
      </FilterSelect>

      <FilterSelect
        size="small"
        value={filters.signal_type}
        onChange={handleSignalChange}
        displayEmpty
        aria-label={t('ideas.filter.allSignals')}
      >
        {SIGNAL_OPTIONS.map(({ value, labelKey }) => (
          <MenuItem key={value} value={value}>
            {t(labelKey)}
          </MenuItem>
        ))}
      </FilterSelect>

      <FilterSelect
        size="small"
        value={filters.ordering || '-created_at'}
        onChange={handleOrderingChange}
        displayEmpty
        aria-label={t('ideas.filter.ordering_newest')}
      >
        {ORDERING_OPTIONS.map(({ value, labelKey }) => (
          <MenuItem key={value} value={value}>
            {t(labelKey)}
          </MenuItem>
        ))}
      </FilterSelect>

      {activeFilterCount > 0 && (
        <Badge
          badgeContent={activeFilterCount}
          color="primary"
          aria-label={`${activeFilterCount} active filters`}
        >
          <FilterListIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        </Badge>
      )}

      {activeFilterCount > 0 && (
        <ClearButton variant="text" onClick={resetFilters}>
          {t('ideas.filter.clearFilters')}
        </ClearButton>
      )}
    </ToolbarRoot>
  );
};
