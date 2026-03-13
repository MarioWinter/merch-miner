import { Badge, Box, Button, InputAdornment, MenuItem, Select, TextField } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { COLORS } from '@/style/constants';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import type { SelectChangeEvent } from '@mui/material';
import type { RootState } from '../../../../store';
import type { UseNicheFiltersReturn } from '../hooks/useNicheFilters';
import type { NicheStatus, PotentialRating } from '../types';
import type { StatusGroup, NicheOrdering } from '../hooks/useNicheFilters';
import { FilterTemplateDropdown } from './FilterTemplateDropdown';

interface NicheFilterToolbarProps {
  filterState: UseNicheFiltersReturn;
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

const SearchInput = styled(TextField)(({ theme }) => ({
  width: 220,
  '& .MuiInputBase-root': {
    height: 36,
    fontSize: '0.8125rem',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: alpha(COLORS.ink, 0.18),
    ...theme.applyStyles('dark', {
      borderColor: alpha(COLORS.white, 0.12),
    }),
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

const NICHE_STATUSES: NicheStatus[] = [
  'data_entry',
  'deep_research',
  'niche_with_potential',
  'to_designer',
  'upload',
  'start_ads',
  'pending',
  'winner',
  'loser',
  'archived',
];

const STATUS_GROUPS: { value: StatusGroup | ''; labelKey: string }[] = [
  { value: '', labelKey: 'niches.statusGroup.all' },
  { value: 'todo', labelKey: 'niches.statusGroup.todo' },
  { value: 'in_progress', labelKey: 'niches.statusGroup.in_progress' },
  { value: 'complete', labelKey: 'niches.statusGroup.complete' },
];

const POTENTIAL_RATINGS: { value: PotentialRating | ''; labelKey: string }[] = [
  { value: '', labelKey: 'niches.potentialRating.none' },
  { value: 'good', labelKey: 'niches.potentialRating.good' },
  { value: 'very_good', labelKey: 'niches.potentialRating.very_good' },
  { value: 'rejected', labelKey: 'niches.potentialRating.rejected' },
];

const ORDERING_OPTIONS: { value: NicheOrdering | ''; labelKey: string }[] = [
  { value: '-created_at', labelKey: 'niches.filter.ordering_created_at_desc' },
  { value: 'created_at', labelKey: 'niches.filter.ordering_created_at' },
  { value: 'name', labelKey: 'niches.filter.ordering_name' },
  { value: '-name', labelKey: 'niches.filter.ordering_name_desc' },
  { value: 'updated_at', labelKey: 'niches.filter.ordering_updated_at' },
  { value: 'position', labelKey: 'niches.filter.ordering_position' },
];

export const NicheFilterToolbar = ({ filterState }: NicheFilterToolbarProps) => {
  const { t } = useTranslation();
  const {
    filters,
    setSearch,
    setStatus,
    setStatusGroup,
    setPotentialRating,
    setAssignedTo,
    setOrdering,
    resetFilters,
    activeFilterCount,
  } = filterState;

  const activeWorkspaceId = useSelector((s: RootState) => s.workspace.activeWorkspaceId);
  const workspaces = useSelector((s: RootState) => s.workspace.workspaces);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const members = activeWorkspace?.members ?? [];

  const handleStatusChange = (e: SelectChangeEvent<unknown>) =>
    setStatus(e.target.value as NicheStatus | '');

  const handleStatusGroupChange = (e: SelectChangeEvent<unknown>) =>
    setStatusGroup(e.target.value as StatusGroup | '');

  const handleRatingChange = (e: SelectChangeEvent<unknown>) =>
    setPotentialRating(e.target.value as PotentialRating | '');

  const handleAssigneeChange = (e: SelectChangeEvent<unknown>) =>
    setAssignedTo(e.target.value as string);

  const handleOrderingChange = (e: SelectChangeEvent<unknown>) =>
    setOrdering(e.target.value as NicheOrdering | '');

  return (
    <ToolbarRoot role="search" aria-label={t('niches.filter.search')}>
      <FilterTemplateDropdown filterState={filterState} />

      <SearchInput
        size="small"
        placeholder={t('niches.filter.search')}
        value={filters.search}
        onChange={(e) => setSearch(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          },
        }}
        aria-label={t('niches.filter.search')}
      />

      <FilterSelect
        size="small"
        value={filters.status_group}
        onChange={handleStatusGroupChange}
        displayEmpty
        aria-label={t('niches.filter.statusGroup')}
      >
        {STATUS_GROUPS.map(({ value, labelKey }) => (
          <MenuItem key={value} value={value}>
            {t(labelKey)}
          </MenuItem>
        ))}
      </FilterSelect>

      <FilterSelect
        size="small"
        value={filters.status}
        onChange={handleStatusChange}
        displayEmpty
        aria-label={t('niches.filter.status')}
      >
        <MenuItem value="">{t('niches.statusGroup.all')}</MenuItem>
        {NICHE_STATUSES.map((s) => (
          <MenuItem key={s} value={s}>
            {t(`niches.status.${s}`)}
          </MenuItem>
        ))}
      </FilterSelect>

      <FilterSelect
        size="small"
        value={filters.potential_rating}
        onChange={handleRatingChange}
        displayEmpty
        aria-label={t('niches.filter.rating')}
      >
        {POTENTIAL_RATINGS.map(({ value, labelKey }) => (
          <MenuItem key={value} value={value}>
            {t(labelKey)}
          </MenuItem>
        ))}
      </FilterSelect>

      <FilterSelect
        size="small"
        value={filters.assigned_to}
        onChange={handleAssigneeChange}
        displayEmpty
        aria-label={t('niches.filter.assignee')}
      >
        <MenuItem value="">{t('niches.table.unassigned')}</MenuItem>
        {members.map((m) => (
          <MenuItem key={m.id} value={String(m.id)}>
            {m.first_name || m.last_name
              ? `${m.first_name} ${m.last_name}`.trim()
              : m.username}
          </MenuItem>
        ))}
      </FilterSelect>

      <FilterSelect
        size="small"
        value={filters.ordering}
        onChange={handleOrderingChange}
        displayEmpty
        aria-label={t('niches.filter.ordering')}
      >
        <MenuItem value="">{t('niches.filter.ordering')}</MenuItem>
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
          aria-label={t('niches.filter.activeFilters', { count: activeFilterCount })}
        >
          <FilterListIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        </Badge>
      )}

      {activeFilterCount > 0 && (
        <ClearButton variant="text" onClick={resetFilters}>
          {t('niches.filter.clearFilters')}
        </ClearButton>
      )}
    </ToolbarRoot>
  );
};
