import { useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { COLORS } from '@/style/constants';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import { NicheRow } from './NicheRow';
import { InlineAddRow } from './InlineAddRow';
import { useColumnWidths } from '../hooks/useColumnWidths';
import type { ColumnKey } from '../hooks/useColumnWidths';
import type { Niche } from '../types';
import type { UseNicheSelectionReturn } from '../hooks/useNicheSelection';
import type { UseInlineEditReturn } from '../hooks/useInlineEdit';
import type { UseInlineAddReturn } from '../hooks/useInlineAdd';
import type { NicheOrdering } from '../hooks/useNicheFilters';

interface NicheTableProps {
  niches: Niche[];
  ordering: NicheOrdering | '';
  onOrderingChange: (value: NicheOrdering | '') => void;
  selection: UseNicheSelectionReturn;
  onRowClick: (id: string) => void;
  onArchive: (id: string) => Promise<void>;
  inlineEdit: UseInlineEditReturn;
  inlineAdd: UseInlineAddReturn;
}

const HeaderCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: 'transparent',
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  padding: '0 12px',
  height: 40,
  position: 'relative',
  userSelect: 'none',
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

const DestructiveMenuItem = styled(MenuItem)(({ theme }) => ({
  color: theme.vars.palette.error.main,
  gap: theme.spacing(1),
  '&:hover': {
    backgroundColor: alpha(COLORS.errorDk, 0.08),
  },
}));

const ResizeHandle = styled('div')(({ theme }) => ({
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: 6,
  cursor: 'col-resize',
  zIndex: 1,
  '&:hover': {
    backgroundColor: alpha(COLORS.white, 0.10),
    ...theme.applyStyles('light', {
      backgroundColor: alpha(COLORS.ink, 0.10),
    }),
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
  inlineEdit,
  inlineAdd,
}: NicheTableProps) => {
  const { t } = useTranslation();
  const { toggleAll, isSelected } = selection;
  const { widths, startResize, isResizing } = useColumnWidths();

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuNicheId, setMenuNicheId] = useState<string | null>(null);
  const [archiveDialogId, setArchiveDialogId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const allSelected = niches.length > 0 && niches.every((n) => isSelected(n.id));
  const someSelected = niches.some((n) => isSelected(n.id));

  const hasCustomWidths = Object.values(widths).some((w) => typeof w === 'number' && w !== 44);

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

  const handleSelectAll = () => {
    toggleAll(niches.map((n) => n.id));
  };

  const handleResizeMouseDown =
    (col: ColumnKey) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startResize(col, e.clientX);
    };

  const nameSortDir = getSortDirection(ordering, 'name');
  const updatedSortDir = getSortDirection(ordering, 'updated_at');

  const tableStyle = hasCustomWidths || isResizing ? { tableLayout: 'fixed' as const } : undefined;

  const colWidth = (key: ColumnKey): number | 'auto' => widths[key];

  return (
    <>
      <Table size="small" aria-label={t('niches.pageTitle')} sx={tableStyle}>
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

            <HeaderCell sx={{ width: colWidth('name') }}>
              <TableSortLabel
                active={!!nameSortDir}
                direction={nameSortDir ?? 'asc'}
                onClick={() => onOrderingChange(toggleSort(ordering, 'name'))}
              >
                {t('niches.table.colName')}
              </TableSortLabel>
              <ResizeHandle onMouseDown={handleResizeMouseDown('name')} />
            </HeaderCell>

            <HeaderCell sx={{ width: colWidth('status') }}>
              <OverlineText>{t('niches.table.colStatus')}</OverlineText>
              <ResizeHandle onMouseDown={handleResizeMouseDown('status')} />
            </HeaderCell>

            <HeaderCell sx={{ width: colWidth('potential_rating') }}>
              <OverlineText>{t('niches.table.colRating')}</OverlineText>
              <ResizeHandle onMouseDown={handleResizeMouseDown('potential_rating')} />
            </HeaderCell>

            <HeaderCell sx={{ width: colWidth('assignee') }}>
              <OverlineText>{t('niches.table.colAssignee')}</OverlineText>
              <ResizeHandle onMouseDown={handleResizeMouseDown('assignee')} />
            </HeaderCell>

            <HeaderCell sx={{ width: colWidth('ideas') }}>
              <OverlineText>{t('niches.table.colIdeas')}</OverlineText>
              <ResizeHandle onMouseDown={handleResizeMouseDown('ideas')} />
            </HeaderCell>

            <HeaderCell sx={{ width: colWidth('updated') }}>
              <TableSortLabel
                active={!!updatedSortDir}
                direction={updatedSortDir ?? 'asc'}
                onClick={() => onOrderingChange(toggleSort(ordering, 'updated_at'))}
              >
                {t('niches.table.colUpdated')}
              </TableSortLabel>
              <ResizeHandle onMouseDown={handleResizeMouseDown('updated')} />
            </HeaderCell>

            <HeaderCell sx={{ width: colWidth('actions') }} aria-label={t('niches.table.colActions')} />
          </TableRow>
        </TableHead>

        <TableBody>
          {niches.map((niche) => (
            <NicheRow
              key={niche.id}
              niche={niche}
              selection={selection}
              inlineEdit={inlineEdit}
              onRowClick={onRowClick}
              onDoubleClick={onRowClick}
              onMenuOpen={handleMenuOpen}
              widths={widths}
            />
          ))}

          <InlineAddRow inlineAdd={inlineAdd} />
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
    </>
  );
};
