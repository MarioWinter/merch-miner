import { useState } from 'react';
import {
  Box,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { COLORS } from '@/style/constants';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { NicheStatusChip } from './NicheStatusChip';
import { PotentialRatingChip } from './PotentialRatingChip';
import type { Niche } from '../types';
import type { UseNicheSelectionReturn } from '../hooks/useNicheSelection';
import type { NicheOrdering } from '../hooks/useNicheFilters';

interface NicheTableProps {
  niches: Niche[];
  ordering: NicheOrdering | '';
  onOrderingChange: (value: NicheOrdering | '') => void;
  selection: UseNicheSelectionReturn;
  onRowClick: (id: string) => void;
  onArchive: (id: string) => Promise<void>;
}

const StyledTableRow = styled(TableRow)(({ theme }) => ({
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

const HeaderCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: 'transparent',
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  padding: '0 12px',
  height: 40,
  '& .MuiTableSortLabel-root': {
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'inherit',
  },
}));

const OverlineText = styled('span')({
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'inherit',
});

const IdeasText = styled(Typography)({
  fontSize: '0.8125rem',
  color: 'inherit',
  fontVariantNumeric: 'tabular-nums',
});

const DestructiveMenuItem = styled(MenuItem)(({ theme }) => ({
  color: theme.vars.palette.error.main,
  gap: theme.spacing(1),
  '&:hover': {
    backgroundColor: alpha(COLORS.errorDk, 0.08),
  },
}));

type SortableColumn = 'name' | 'updated_at';

const getSortDirection = (
  ordering: NicheOrdering | '',
  col: SortableColumn,
): 'asc' | 'desc' | undefined => {
  if (ordering === col) return 'asc';
  if (ordering === `-${col}`) return 'desc';
  return undefined;
};

const toggleSort = (
  current: NicheOrdering | '',
  col: SortableColumn,
): NicheOrdering => {
  if (current === col) return `-${col}` as NicheOrdering;
  return col;
};

export const NicheTable = ({
  niches,
  ordering,
  onOrderingChange,
  selection,
  onRowClick,
  onArchive,
}: NicheTableProps) => {
  const { t } = useTranslation();
  const { selectedIds, toggleOne, toggleAll, isSelected } = selection;

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuNicheId, setMenuNicheId] = useState<string | null>(null);
  const [archiveDialogId, setArchiveDialogId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const allSelected = niches.length > 0 && niches.every((n) => isSelected(n.id));
  const someSelected = niches.some((n) => isSelected(n.id));

  const handleMenuOpen = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuNicheId(id);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuNicheId(null);
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setArchiveDialogId(menuNicheId);
    handleMenuClose();
  };

  const handleArchiveConfirm = async () => {
    if (!archiveDialogId) return;
    setArchiving(true);
    try {
      await onArchive(archiveDialogId);
    } finally {
      setArchiving(false);
      setArchiveDialogId(null);
    }
  };

  const handleRowClick = (id: string) => {
    onRowClick(id);
  };

  const handleCheckboxClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toggleOne(id);
  };

  const handleSelectAll = () => {
    toggleAll(niches.map((n) => n.id));
  };

  const nameSortDir = getSortDirection(ordering, 'name');
  const updatedSortDir = getSortDirection(ordering, 'updated_at');

  return (
    <>
      <Table size="small" aria-label={t('niches.pageTitle')}>
        <TableHead>
          <TableRow>
            <HeaderCell padding="checkbox" sx={{ width: 44 }}>
              <Checkbox
                size="small"
                indeterminate={someSelected && !allSelected}
                checked={allSelected}
                onChange={handleSelectAll}
                slotProps={{ input: { 'aria-label': 'Select all niches' } }}
              />
            </HeaderCell>

            <HeaderCell>
              <TableSortLabel
                active={!!nameSortDir}
                direction={nameSortDir ?? 'asc'}
                onClick={() => onOrderingChange(toggleSort(ordering, 'name'))}
              >
                {t('niches.table.colName')}
              </TableSortLabel>
            </HeaderCell>

            <HeaderCell sx={{ width: 160 }}>
              <OverlineText>{t('niches.table.colStatus')}</OverlineText>
            </HeaderCell>

            <HeaderCell sx={{ width: 120 }}>
              <OverlineText>{t('niches.table.colRating')}</OverlineText>
            </HeaderCell>

            <HeaderCell sx={{ width: 140 }}>
              <OverlineText>{t('niches.table.colAssignee')}</OverlineText>
            </HeaderCell>

            <HeaderCell sx={{ width: 80 }}>
              <OverlineText>{t('niches.table.colIdeas')}</OverlineText>
            </HeaderCell>

            <HeaderCell sx={{ width: 120 }}>
              <TableSortLabel
                active={!!updatedSortDir}
                direction={updatedSortDir ?? 'asc'}
                onClick={() => onOrderingChange(toggleSort(ordering, 'updated_at'))}
              >
                {t('niches.table.colUpdated')}
              </TableSortLabel>
            </HeaderCell>

            <HeaderCell sx={{ width: 44 }} aria-label={t('niches.table.colActions')} />
          </TableRow>
        </TableHead>

        <TableBody>
          {niches.map((niche) => {
            const selected = isSelected(niche.id);
            const updatedAgo = formatDistanceToNow(new Date(niche.updated_at), {
              addSuffix: true,
            });

            return (
              <StyledTableRow
                key={niche.id}
                selected={selected}
                onClick={() => handleRowClick(niche.id)}
                aria-label={niche.name}
                sx={selected ? { backgroundColor: alpha(COLORS.red, 0.06) } : undefined}
              >
                <TableCell padding="checkbox" onClick={(e) => handleCheckboxClick(e, niche.id)}>
                  <Checkbox
                    size="small"
                    checked={selected}
                    slotProps={{ input: { 'aria-label': `Select ${niche.name}` } }}
                  />
                </TableCell>

                <TableCell>
                  <Typography variant="body2" fontWeight={500} noWrap>
                    {niche.name}
                  </Typography>
                </TableCell>

                <TableCell>
                  <NicheStatusChip status={niche.status} />
                </TableCell>

                <TableCell>
                  <PotentialRatingChip potentialRating={niche.potential_rating} />
                </TableCell>

                <TableCell>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {niche.assigned_to
                      ? String(niche.assigned_to)
                      : t('niches.table.unassigned')}
                  </Typography>
                </TableCell>

                <TableCell>
                  <IdeasText variant="body2">
                    {niche.approved_idea_count} / {niche.idea_count}
                  </IdeasText>
                </TableCell>

                <TableCell>
                  <Tooltip title={new Date(niche.updated_at).toLocaleString()}>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {updatedAgo}
                    </Typography>
                  </Tooltip>
                </TableCell>

                <TableCell onClick={(e) => e.stopPropagation()}>
                  <IconButton
                    size="small"
                    aria-label={t('niches.table.colActions')}
                    onClick={(e) => handleMenuOpen(e, niche.id)}
                    sx={{ borderRadius: '8px' }}
                  >
                    <MoreVertIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </TableCell>
              </StyledTableRow>
            );
          })}
        </TableBody>
      </Table>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <DestructiveMenuItem onClick={handleArchiveClick}>
          <DeleteOutlineIcon fontSize="small" />
          {t('niches.drawer.archive')}
        </DestructiveMenuItem>
      </Menu>

      <Dialog
        open={Boolean(archiveDialogId)}
        onClose={() => setArchiveDialogId(null)}
        aria-labelledby="archive-dialog-title"
      >
        <DialogTitle id="archive-dialog-title">
          {t('niches.drawer.archiveConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{t('niches.drawer.archiveConfirmBody')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            variant="text"
            onClick={() => setArchiveDialogId(null)}
            disabled={archiving}
          >
            {t('niches.drawer.archiveCancel')}
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={handleArchiveConfirm}
            disabled={archiving}
            startIcon={<DeleteOutlineIcon />}
          >
            {t('niches.drawer.archiveConfirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {selectedIds.size > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t('niches.bulk.selected', { count: selectedIds.size })}
          </Typography>
        </Box>
      )}
    </>
  );
};
