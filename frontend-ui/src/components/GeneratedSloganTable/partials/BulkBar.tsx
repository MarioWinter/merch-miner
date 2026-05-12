/**
 * PROJ-29 Phase 1H-2 — toolbar above GeneratedSloganTable: select-all,
 * Copy all, Add all + selection summary. Bulk actions target the selection
 * if any rows are selected, otherwise act on all visible rows.
 */
import { Box, Button, Checkbox, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { useTranslation } from 'react-i18next';

interface BulkBarProps {
  totalCount: number;
  selectedCount: number;
  duplicatesCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onCopyAll: () => void;
  onAddAll: () => void;
  busy: boolean;
}

const Bar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1.5),
  padding: theme.spacing(0.75, 1, 0.75, 1),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: theme.vars.palette.background.paper,
  flexWrap: 'wrap',
}));

const BulkBar = ({
  totalCount,
  selectedCount,
  duplicatesCount,
  allSelected,
  onToggleAll,
  onCopyAll,
  onAddAll,
  busy,
}: BulkBarProps) => {
  const { t } = useTranslation();
  const summary = selectedCount > 0
    ? duplicatesCount > 0
      ? t('chatNicheRag.slogans.summary.withDuplicates', { count: selectedCount, dupes: duplicatesCount })
      : t('chatNicheRag.slogans.summary.selected', { count: selectedCount })
    : t('chatNicheRag.slogans.header', { count: totalCount });

  return (
    <Bar>
      <Stack direction="row" alignItems="center" gap={1}>
        <Checkbox
          size="small"
          checked={allSelected}
          indeterminate={selectedCount > 0 && !allSelected}
          onChange={onToggleAll}
          inputProps={{ 'aria-label': t('chatNicheRag.slogans.selectAll') }}
          sx={{ p: 0.5 }}
        />
        <Typography variant="body2" color="text.secondary">
          {summary}
        </Typography>
      </Stack>
      <Stack direction="row" gap={0.75}>
        <Button
          size="small"
          variant="text"
          color="inherit"
          startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
          onClick={onCopyAll}
          disabled={totalCount === 0}
        >
          {t('chatNicheRag.slogans.action.copyAll')}
        </Button>
        <Button
          size="small"
          variant="contained"
          color="primary"
          startIcon={<PlaylistAddIcon sx={{ fontSize: 16 }} />}
          onClick={onAddAll}
          disabled={totalCount === 0 || busy}
        >
          {t('chatNicheRag.slogans.action.addAll')}
        </Button>
      </Stack>
    </Bar>
  );
};

export default BulkBar;
