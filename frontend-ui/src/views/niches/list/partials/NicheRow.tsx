import { useRef, useEffect, useState } from 'react';
import {
  Autocomplete,
  Checkbox,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../../store';
import { COLORS } from '@/style/constants';
import { NicheStatusChip } from './NicheStatusChip';
import { PotentialRatingChip } from './PotentialRatingChip';
import type { Niche, NicheStatus, PotentialRating } from '../types';
import type { UseNicheSelectionReturn } from '../hooks/useNicheSelection';
import type { UseInlineEditReturn, EditableColumn } from '../hooks/useInlineEdit';
import type { ColumnWidths } from '../hooks/useColumnWidths';

const NICHE_STATUSES: NicheStatus[] = [
  'data_entry', 'deep_research', 'niche_with_potential',
  'to_designer', 'upload', 'start_ads',
  'pending', 'winner', 'loser',
];

const POTENTIAL_RATINGS: Array<PotentialRating | ''> = ['', 'good', 'very_good', 'rejected'];

interface NicheRowProps {
  niche: Niche;
  selection: UseNicheSelectionReturn;
  inlineEdit: UseInlineEditReturn;
  onRowClick: (id: string) => void;
  onDoubleClick: (id: string) => void;
  onMenuOpen: (e: React.MouseEvent<HTMLButtonElement>, id: string) => void;
  widths?: ColumnWidths;
}

const StyledRow = styled(TableRow)(({ theme }) => ({
  cursor: 'pointer',
  transition: 'background-color 150ms ease',
  '&:hover': {
    backgroundColor: alpha(COLORS.white, 0.03),
    ...theme.applyStyles('light', {
      backgroundColor: alpha(COLORS.ink, 0.03),
    }),
  },
  '& td': {
    borderBottom: `1px solid ${theme.vars.palette.divider}`,
    padding: '0 12px',
    height: 44,
  },
}));

const EditingCell = styled(TableCell)(({ theme }) => ({
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  padding: '0 6px !important',
  height: 44,
  outline: `2px solid ${theme.vars.palette.primary.main}`,
  outlineOffset: -2,
  borderRadius: 4,
}));

const IdeasText = styled(Typography)({
  fontSize: '0.8125rem',
  fontVariantNumeric: 'tabular-nums',
});

const isCellActive = (
  activeCell: UseInlineEditReturn['activeCell'],
  nicheId: string,
  column: EditableColumn,
): boolean => activeCell?.nicheId === nicheId && activeCell?.column === column;

// — Name input — isolated component, mounts fresh when active flips to true

interface NameInputProps {
  initialValue: string;
  isSaving: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
}

const NameInput = ({ initialValue, isSaving, onSave, onCancel }: NameInputProps) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave(value);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleBlur = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialValue) {
      onSave(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <TextField
      inputRef={inputRef}
      size="small"
      fullWidth
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      disabled={isSaving}
      slotProps={{
        input: {
          endAdornment: isSaving ? (
            <CircularProgress size={14} sx={{ mr: 0.5 }} />
          ) : undefined,
        },
      }}
      sx={{ '& .MuiOutlinedInput-root': { height: 32, fontSize: '0.875rem' } }}
    />
  );
};

// — Name cell

interface NameCellProps {
  niche: Niche;
  inlineEdit: UseInlineEditReturn;
}

const NameCell = ({ niche, inlineEdit }: NameCellProps) => {
  const { t } = useTranslation();
  const active = isCellActive(inlineEdit.activeCell, niche.id, 'name');

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    inlineEdit.activateCell(niche.id, 'name');
  };

  if (!active) {
    return (
      <TableCell onClick={handleClick} aria-label={t('niches.table.colName')}>
        <Typography variant="body2" fontWeight={500} noWrap>
          {niche.name}
        </Typography>
      </TableCell>
    );
  }

  return (
    <EditingCell onClick={(e) => e.stopPropagation()} aria-label={t('niches.table.colName')}>
      <NameInput
        key={`name-${niche.id}`}
        initialValue={niche.name}
        isSaving={inlineEdit.isSaving}
        onSave={(val) => void inlineEdit.saveName(niche.id, val)}
        onCancel={inlineEdit.deactivateCell}
      />
    </EditingCell>
  );
};

// — Status cell

interface StatusCellProps {
  niche: Niche;
  inlineEdit: UseInlineEditReturn;
  width?: number | 'auto';
}

const StatusCell = ({ niche, inlineEdit, width }: StatusCellProps) => {
  const { t } = useTranslation();
  const active = isCellActive(inlineEdit.activeCell, niche.id, 'status');
  const w = width ?? 160;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    inlineEdit.activateCell(niche.id, 'status');
  };

  if (!active) {
    return (
      <TableCell sx={{ width: w }} onClick={handleClick} aria-label={t('niches.table.colStatus')}>
        <NicheStatusChip status={niche.status} />
      </TableCell>
    );
  }

  return (
    <EditingCell sx={{ width: w }} onClick={(e) => e.stopPropagation()} aria-label={t('niches.table.colStatus')}>
      <Select
        value={niche.status}
        onChange={(e) => void inlineEdit.saveStatus(niche.id, e.target.value as NicheStatus)}
        size="small"
        fullWidth
        autoFocus
        onClose={inlineEdit.deactivateCell}
        disabled={inlineEdit.isSaving}
        sx={{ height: 32, fontSize: '0.875rem' }}
      >
        {NICHE_STATUSES.map((s) => (
          <MenuItem key={s} value={s}>{t(`niches.status.${s}`)}</MenuItem>
        ))}
      </Select>
    </EditingCell>
  );
};

// — Rating cell

interface RatingCellProps {
  niche: Niche;
  inlineEdit: UseInlineEditReturn;
  width?: number | 'auto';
}

const RatingCell = ({ niche, inlineEdit, width }: RatingCellProps) => {
  const { t } = useTranslation();
  const active = isCellActive(inlineEdit.activeCell, niche.id, 'potential_rating');
  const w = width ?? 120;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    inlineEdit.activateCell(niche.id, 'potential_rating');
  };

  if (!active) {
    return (
      <TableCell sx={{ width: w }} onClick={handleClick} aria-label={t('niches.table.colRating')}>
        <PotentialRatingChip potentialRating={niche.potential_rating} />
      </TableCell>
    );
  }

  return (
    <EditingCell sx={{ width: w }} onClick={(e) => e.stopPropagation()} aria-label={t('niches.table.colRating')}>
      <Select
        value={niche.potential_rating ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          void inlineEdit.savePotentialRating(niche.id, (val || null) as PotentialRating | null);
        }}
        size="small"
        fullWidth
        autoFocus
        onClose={inlineEdit.deactivateCell}
        disabled={inlineEdit.isSaving}
        displayEmpty
        sx={{ height: 32, fontSize: '0.875rem' }}
      >
        {POTENTIAL_RATINGS.map((r) => (
          <MenuItem key={r} value={r}>
            {r ? t(`niches.potentialRating.${r}`) : t('niches.potentialRating.none')}
          </MenuItem>
        ))}
      </Select>
    </EditingCell>
  );
};

// — Assignee cell

interface AssigneeCellProps {
  niche: Niche;
  inlineEdit: UseInlineEditReturn;
  width?: number | 'auto';
}

const AssigneeCell = ({ niche, inlineEdit, width }: AssigneeCellProps) => {
  const { t } = useTranslation();
  const active = isCellActive(inlineEdit.activeCell, niche.id, 'assignee');
  const w = width ?? 140;

  const activeWorkspaceId = useSelector((s: RootState) => s.workspace.activeWorkspaceId);
  const workspaces = useSelector((s: RootState) => s.workspace.workspaces);
  const members = workspaces.find((w) => w.id === activeWorkspaceId)?.members ?? [];
  const selectedMember = members.find((m) => m.id === niche.assigned_to) ?? null;

  const getMemberLabel = (m: { first_name: string; last_name: string; username: string }) =>
    m.first_name || m.last_name ? `${m.first_name} ${m.last_name}`.trim() : m.username;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    inlineEdit.activateCell(niche.id, 'assignee');
  };

  if (!active) {
    return (
      <TableCell sx={{ width: w }} onClick={handleClick} aria-label={t('niches.table.colAssignee')}>
        <Typography variant="caption" color="text.secondary" noWrap>
          {selectedMember ? getMemberLabel(selectedMember) : t('niches.table.unassigned')}
        </Typography>
      </TableCell>
    );
  }

  return (
    <EditingCell sx={{ width: w }} onClick={(e) => e.stopPropagation()} aria-label={t('niches.table.colAssignee')}>
      <Autocomplete
        options={members}
        getOptionLabel={getMemberLabel}
        value={selectedMember}
        onChange={(_, val) => {
          void inlineEdit.saveAssignee(niche.id, val?.id ?? null);
        }}
        onBlur={inlineEdit.deactivateCell}
        clearOnEscape
        openOnFocus
        size="small"
        disabled={inlineEdit.isSaving}
        renderInput={(params) => (
          <TextField
            {...params}
            autoFocus
            placeholder={t('niches.table.unassigned')}
            sx={{ '& .MuiOutlinedInput-root': { height: 32, fontSize: '0.875rem' } }}
          />
        )}
        sx={{ minWidth: 120 }}
      />
    </EditingCell>
  );
};

// — Main NicheRow

export const NicheRow = ({
  niche,
  selection,
  inlineEdit,
  onRowClick,
  onDoubleClick,
  onMenuOpen,
  widths,
}: NicheRowProps) => {
  const { t } = useTranslation();
  const { toggleOne, isSelected } = selection;
  const selected = isSelected(niche.id);
  const updatedAgo = dayjs(niche.updated_at).fromNow();

  // Kept for compatibility — single-click on non-editable areas does not open drawer
  void onRowClick;

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleOne(niche.id);
  };

  const handleDoubleClick = () => {
    if (inlineEdit.activeCell?.nicheId === niche.id) {
      inlineEdit.deactivateCell();
    }
    onDoubleClick(niche.id);
  };

  const w = widths;

  return (
    <StyledRow
      selected={selected}
      onDoubleClick={handleDoubleClick}
      aria-label={niche.name}
      sx={selected ? { backgroundColor: alpha(COLORS.red, 0.06) } : undefined}
    >
      <TableCell padding="checkbox" onClick={handleCheckboxClick} sx={{ width: 44 }}>
        <Checkbox
          size="small"
          checked={selected}
          slotProps={{ input: { 'aria-label': `Select ${niche.name}` } }}
        />
      </TableCell>

      <NameCell niche={niche} inlineEdit={inlineEdit} />
      <StatusCell niche={niche} inlineEdit={inlineEdit} width={w?.status} />
      <RatingCell niche={niche} inlineEdit={inlineEdit} width={w?.potential_rating} />
      <AssigneeCell niche={niche} inlineEdit={inlineEdit} width={w?.assignee} />

      <TableCell sx={{ width: w?.ideas ?? 80 }} onClick={(e) => e.stopPropagation()}>
        <IdeasText variant="body2">
          {niche.approved_idea_count} / {niche.idea_count}
        </IdeasText>
      </TableCell>

      <TableCell sx={{ width: w?.updated ?? 120 }}>
        <Tooltip title={new Date(niche.updated_at).toLocaleString()}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {updatedAgo}
          </Typography>
        </Tooltip>
      </TableCell>

      <TableCell sx={{ width: w?.actions ?? 44 }} onClick={(e) => e.stopPropagation()}>
        <IconButton
          size="small"
          aria-label={t('niches.table.colActions')}
          onClick={(e) => onMenuOpen(e, niche.id)}
          sx={{ borderRadius: '8px' }}
        >
          <MoreVertIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </TableCell>
    </StyledRow>
  );
};
