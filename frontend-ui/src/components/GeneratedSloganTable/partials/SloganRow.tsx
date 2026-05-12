/**
 * PROJ-29 Phase 1H-2 — one row of GeneratedSloganTable.
 *
 * Renders as MUI TableRow on `md+` and as a stacked card on `xs` (Q1 → B
 * vertical card-stack at the xs breakpoint).
 */
import { useState } from 'react';
import {
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useTranslation } from 'react-i18next';
import ConfidenceChip from './ConfidenceChip';
import type { SloganRow as SloganRowData, RowStatus } from '../types/slogan';

interface SloganRowProps {
  index: number;
  row: SloganRowData;
  status: RowStatus;
  selected: boolean;
  onToggleSelect: () => void;
  onCopy: () => void;
  onAdd: () => void;
  /** PROJ-29 Phase 1I follow-up: parent measures container width and forces
   *  the card-stack layout for narrow drawers (where viewport-based
   *  `useMediaQuery` wouldn't trigger). Falls back to the viewport check. */
  narrow?: boolean;
}

const SloganCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 500,
  color: theme.vars.palette.text.primary,
  fontSize: '0.9375rem',
  lineHeight: 1.45,
}));

const MetaChip = styled(Chip)({
  '& .MuiChip-label': { fontSize: '0.6875rem', letterSpacing: '0.02em' },
});

const CardWrap = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: theme.shape.borderRadius * 1.5,
  padding: theme.spacing(1.5),
  backgroundColor: theme.vars.palette.background.paper,
}));

const StatusIcon = ({ status }: { status: RowStatus }) => {
  const { t } = useTranslation();
  if (status === 'loading') return <CircularProgress size={14} />;
  if (status === 'added' || status === 'copied') {
    return (
      <Tooltip title={t('chatNicheRag.slogans.action.added')}>
        <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
      </Tooltip>
    );
  }
  if (status === 'duplicate') {
    return (
      <Tooltip title={t('chatNicheRag.slogans.action.duplicate')}>
        <WarningAmberIcon sx={{ fontSize: 16, color: 'warning.main' }} />
      </Tooltip>
    );
  }
  if (status === 'error') {
    return (
      <Tooltip title={t('chatNicheRag.slogans.action.error')}>
        <ErrorOutlineIcon sx={{ fontSize: 16, color: 'error.main' }} />
      </Tooltip>
    );
  }
  return <Box sx={{ width: 16, height: 16 }} aria-hidden="true" />;
};

const SloganRowView = ({
  row,
  status,
  selected,
  onToggleSelect,
  onCopy,
  onAdd,
  narrow,
}: SloganRowProps) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const viewportNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const useCardLayout = narrow ?? viewportNarrow;
  const [hovering, setHovering] = useState(false);

  const archetype = Array.isArray(row.emotional_archetype)
    ? row.emotional_archetype.join(', ')
    : row.emotional_archetype;
  const canAct = status === 'idle' || status === 'error' || status === 'copied';

  if (useCardLayout) {
    return (
      <CardWrap data-row-status={status}>
        <Stack direction="row" alignItems="flex-start" gap={1}>
          <Checkbox
            size="small"
            checked={selected}
            onChange={onToggleSelect}
            sx={{ p: 0.5, mt: -0.5 }}
            inputProps={{ 'aria-label': t('chatNicheRag.slogans.selectAll') }}
          />
          <Stack flex={1} minWidth={0} gap={1}>
            <Typography variant="body1" fontWeight={500}>
              {row.slogan_text}
            </Typography>
            <Stack direction="row" gap={0.5} flexWrap="wrap">
              <MetaChip size="small" variant="outlined" label={t(`chatNicheRag.slogans.signal.${row.signal_type}`)} />
              <MetaChip size="small" variant="outlined" label={row.pattern_used || '—'} />
              <MetaChip size="small" variant="outlined" label={row.stylistic_device || '—'} />
              <ConfidenceChip level={row.market_confidence} />
            </Stack>
            {archetype && (
              <Typography variant="caption" color="text.secondary">
                {archetype}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" gap={0.25} alignItems="center">
            <IconButton size="small" onClick={onCopy} aria-label={t('chatNicheRag.slogans.action.copy')}>
              <ContentCopyIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={onAdd}
              disabled={!canAct}
              aria-label={t('chatNicheRag.slogans.action.add')}
            >
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <StatusIcon status={status} />
          </Stack>
        </Stack>
      </CardWrap>
    );
  }

  return (
    <TableRow
      hover
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      data-row-status={status}
      selected={selected}
    >
      <TableCell padding="checkbox">
        <Checkbox
          size="small"
          checked={selected}
          onChange={onToggleSelect}
          inputProps={{ 'aria-label': t('chatNicheRag.slogans.selectAll') }}
        />
      </TableCell>
      <SloganCell>{row.slogan_text}</SloganCell>
      <TableCell>
        <MetaChip size="small" variant="outlined" label={t(`chatNicheRag.slogans.signal.${row.signal_type}`)} />
      </TableCell>
      <TableCell>
        <MetaChip size="small" variant="outlined" label={row.pattern_used || '—'} />
      </TableCell>
      <TableCell>
        <MetaChip size="small" variant="outlined" label={row.stylistic_device || '—'} />
      </TableCell>
      <TableCell>
        <ConfidenceChip level={row.market_confidence} />
      </TableCell>
      <TableCell align="right">
        <Stack direction="row" gap={0.25} alignItems="center" justifyContent="flex-end">
          <IconButton
            size="small"
            onClick={onCopy}
            aria-label={t('chatNicheRag.slogans.action.copy')}
            sx={{ visibility: hovering || status === 'copied' ? 'visible' : 'hidden' }}
          >
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={onAdd}
            disabled={!canAct}
            aria-label={t('chatNicheRag.slogans.action.add')}
          >
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <StatusIcon status={status} />
        </Stack>
      </TableCell>
    </TableRow>
  );
};

export default SloganRowView;
