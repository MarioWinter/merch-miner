/**
 * PROJ-29 Phase 1H-2 — GeneratedSloganTable.
 *
 * Renders the structured `generate_slogans_payload` from a chat agent turn.
 * Lives BELOW the assistant bubble in ChatMessageList when an assistant
 * message has a slogan payload (live during stream OR persisted on message).
 *
 * Decisions (locked 2026-05-12):
 *   - Q1 → B: mobile <600px renders card-stack via SloganRow's responsive switch.
 *   - Q6 → manual Add only: never auto-persist on stream end. User triggers Add/Add-all.
 *   - Q3 → A: backend persists payload on assistant message; frontend reads from
 *     `msg.generate_slogans_payload` (handled by ChatMessageList passing `rows` prop here).
 *
 * Niche resolution:
 *   - `sessionNicheId` (from session.niche_context) wins.
 *   - When null + workspace has 1 niche: auto-pick.
 *   - When null + workspace has >1 niche: open NichePickerDialog (deferred to first Add click).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Stack,
  Table,
  TableBody,
  TableContainer,
  TableHead,
  TableRow as MuiTableRow,
  TableCell,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useListNichesQuery } from '@/store/nicheSlice';
import NichePickerDialog from '@/components/NichePickerDialog';
import BulkBar from './partials/BulkBar';
import SloganRow from './partials/SloganRow';
import { useAddSloganToNiche } from './hooks/useAddSloganToNiche';
import { useSloganTableSelection } from './hooks/useSloganTableSelection';
import type { SloganRow as SloganRowData } from './types/slogan';

interface GeneratedSloganTableProps {
  rows: SloganRowData[];
  /** Niche the session is anchored to; null when chat started without context. */
  sessionNicheId: string | null;
}

const Outer = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: theme.shape.borderRadius * 1.5,
  backgroundColor: theme.vars.palette.background.paper,
  overflow: 'hidden',
  marginTop: theme.spacing(1),
}));

const HeaderCell = styled(TableCell)(({ theme }) => ({
  ...theme.typography.overline,
  color: theme.vars.palette.text.secondary,
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
}));

const CardList = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(1),
  padding: theme.spacing(1),
}));

// PROJ-29 Phase 1I follow-up: container-width threshold below which we render
// the card-stack layout instead of the dense Table. The drawer is 480/768/1200
// px wide regardless of viewport size, so `useMediaQuery` on the viewport
// would never trigger inside a narrow drawer. We measure the table's own
// outer container with ResizeObserver instead.
const CARD_STACK_BREAKPOINT_PX = 680;

const GeneratedSloganTable = ({ rows, sessionNicheId }: GeneratedSloganTableProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() => 9999);
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    setContainerWidth(node.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === 'number') setContainerWidth(w);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  const isNarrow = containerWidth < CARD_STACK_BREAKPOINT_PX;

  const selection = useSloganTableSelection();
  const { statusByIndex, addRow, addMany } = useAddSloganToNiche();

  // Need workspace niches to know whether to prompt the user.
  const { data: nichesData } = useListNichesQuery(
    { page_size: 200 },
    { skip: sessionNicheId !== null },
  );
  const workspaceNicheCount = nichesData?.results?.length ?? 0;
  const onlyNicheId =
    sessionNicheId === null && workspaceNicheCount === 1
      ? (nichesData?.results?.[0]?.id ?? null)
      : null;

  // Niche cache: once user picks via dialog, reuse for subsequent Adds in this render lifecycle.
  const [pickedNicheId, setPickedNicheId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<null | { kind: 'one'; idx: number } | { kind: 'many'; indexes: number[] }>(null);

  const effectiveNicheId = sessionNicheId ?? pickedNicheId ?? onlyNicheId;

  const handleAdd = useCallback(
    (idx: number) => {
      const row = rows[idx];
      if (!row) return;
      if (!effectiveNicheId) {
        setPendingAction({ kind: 'one', idx });
        return;
      }
      void addRow(idx, row, effectiveNicheId);
    },
    [rows, effectiveNicheId, addRow],
  );

  const handleAddAll = useCallback(() => {
    const indexes =
      selection.selected.size > 0
        ? Array.from(selection.selected).sort((a, b) => a - b)
        : rows.map((_, i) => i);
    if (!effectiveNicheId) {
      setPendingAction({ kind: 'many', indexes });
      return;
    }
    void addMany(indexes, rows, effectiveNicheId);
  }, [selection.selected, rows, effectiveNicheId, addMany]);

  const handleConfirmPicker = useCallback(
    (nicheId: string) => {
      setPickedNicheId(nicheId);
      const action = pendingAction;
      setPendingAction(null);
      if (!action) return;
      if (action.kind === 'one') {
        const row = rows[action.idx];
        if (row) void addRow(action.idx, row, nicheId);
      } else {
        void addMany(action.indexes, rows, nicheId);
      }
    },
    [pendingAction, rows, addRow, addMany],
  );

  const handleCopy = useCallback(
    async (idx: number) => {
      const row = rows[idx];
      if (!row) return;
      try {
        await navigator.clipboard.writeText(row.slogan_text);
        enqueueSnackbar(t('chatNicheRag.slogans.action.copied'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('chatNicheRag.slogans.action.error'), { variant: 'error' });
      }
    },
    [rows, enqueueSnackbar, t],
  );

  const handleCopyAll = useCallback(async () => {
    const indexes =
      selection.selected.size > 0
        ? Array.from(selection.selected).sort((a, b) => a - b)
        : rows.map((_, i) => i);
    const text = indexes
      .map((i) => rows[i]?.slogan_text)
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      enqueueSnackbar(t('chatNicheRag.slogans.action.copied'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('chatNicheRag.slogans.action.error'), { variant: 'error' });
    }
  }, [selection.selected, rows, enqueueSnackbar, t]);

  const duplicatesCount = useMemo(
    () => Object.values(statusByIndex).filter((s) => s === 'duplicate').length,
    [statusByIndex],
  );
  const busy = useMemo(
    () => Object.values(statusByIndex).some((s) => s === 'loading'),
    [statusByIndex],
  );

  if (rows.length === 0) {
    return (
      <Outer ref={containerRef}>
        <Alert severity="info" variant="outlined" sx={{ border: 0 }}>
          {t('chatNicheRag.slogans.empty')}
        </Alert>
      </Outer>
    );
  }

  return (
    <>
      <Outer
        ref={containerRef}
        aria-label={t('chatNicheRag.slogans.header', { count: rows.length })}
      >
        <BulkBar
          totalCount={rows.length}
          selectedCount={selection.selected.size}
          duplicatesCount={duplicatesCount}
          allSelected={selection.allSelected(rows.length)}
          onToggleAll={() => selection.toggleAll(rows.length)}
          onCopyAll={handleCopyAll}
          onAddAll={handleAddAll}
          busy={busy}
        />
        {isNarrow ? (
          <CardList>
            {rows.map((row, idx) => (
              <SloganRow
                key={idx}
                index={idx}
                row={row}
                status={statusByIndex[idx] ?? 'idle'}
                selected={selection.isSelected(idx)}
                onToggleSelect={() => selection.toggle(idx)}
                onCopy={() => void handleCopy(idx)}
                onAdd={() => handleAdd(idx)}
                narrow
              />
            ))}
          </CardList>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <MuiTableRow>
                  <HeaderCell padding="checkbox" />
                  <HeaderCell>{t('chatNicheRag.slogans.col.slogan')}</HeaderCell>
                  <HeaderCell>{t('chatNicheRag.slogans.col.signal')}</HeaderCell>
                  <HeaderCell>{t('chatNicheRag.slogans.col.pattern')}</HeaderCell>
                  <HeaderCell>{t('chatNicheRag.slogans.col.device')}</HeaderCell>
                  <HeaderCell>{t('chatNicheRag.slogans.col.confidence')}</HeaderCell>
                  <HeaderCell align="right">{t('chatNicheRag.slogans.col.actions')}</HeaderCell>
                </MuiTableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <SloganRow
                    key={idx}
                    index={idx}
                    row={row}
                    status={statusByIndex[idx] ?? 'idle'}
                    selected={selection.isSelected(idx)}
                    onToggleSelect={() => selection.toggle(idx)}
                    onCopy={() => void handleCopy(idx)}
                    onAdd={() => handleAdd(idx)}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Outer>
      <NichePickerDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmPicker}
      />
    </>
  );
};

export default GeneratedSloganTable;
