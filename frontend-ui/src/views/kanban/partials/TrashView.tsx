import { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import RestoreFromTrashOutlinedIcon from '@mui/icons-material/RestoreFromTrashOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useListTrashQuery, useRestoreDesignMutation } from '@/store/kanbanSlice';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import type { DesignTrashItem } from '../types';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const TrashRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1, 1.5),
  borderRadius: 8,
  border: `1px solid ${theme.vars.palette.divider}`,
}));

const TinyThumb = styled('img')({
  width: 36,
  height: 36,
  borderRadius: 4,
  objectFit: 'cover',
});

const CardThumb = styled('img')({
  width: 56,
  height: 56,
  borderRadius: 8,
  objectFit: 'cover',
});

/**
 * PROJ-30 T3.16 — mobile card variant of TrashRow used on `<sm` viewports.
 * Mirrors the row layout but trades the inline button for a stacked
 * action layout that pairs well with a sticky bulk-action bar.
 */
const TrashCard = styled(Paper)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5, 2),
  borderRadius: 12,
}));

/**
 * PROJ-30 T3.16 — bulk-action bar pinned to viewport bottom on `<sm`.
 * Same pattern as IdeaListView (Phase 3A) — sits above `safe-area-inset-bottom`
 * so it never overlaps the iOS home indicator.
 */
const BulkActionBar = styled(Stack)(({ theme }) => ({
  position: 'fixed',
  bottom: 'env(safe-area-inset-bottom, 0px)',
  left: 0,
  right: 0,
  zIndex: 1100,
  padding: theme.spacing(2),
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(1),
  backgroundColor: theme.vars.palette.background.paper,
  borderTop: `1px solid ${theme.vars.palette.divider}`,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const daysUntil = (expiresAt: string): number => {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
};

// ---------------------------------------------------------------------------
// Row variant (≥sm)
// ---------------------------------------------------------------------------

interface TrashItemRowProps {
  item: DesignTrashItem;
  onRestore: (designId: string) => void;
}

const TrashItemRow = ({ item, onRestore }: TrashItemRowProps) => {
  const { t } = useTranslation();
  const days = daysUntil(item.expires_at);

  return (
    <TrashRow>
      {item.thumbnail_url ? (
        <TinyThumb src={item.thumbnail_url} alt={item.file_name} />
      ) : (
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1,
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ImageOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
        </Box>
      )}

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>
          {item.file_name}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {t('kanban.trash.expiresIn', { days })}
        </Typography>
      </Box>

      <Button
        size="small"
        startIcon={<RestoreFromTrashOutlinedIcon sx={{ fontSize: 16 }} />}
        onClick={() => onRestore(item.design)}
      >
        {t('kanban.trash.restore')}
      </Button>
    </TrashRow>
  );
};

// ---------------------------------------------------------------------------
// Card variant (<sm)
// ---------------------------------------------------------------------------

interface TrashItemCardProps {
  item: DesignTrashItem;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRestore: (designId: string) => void;
}

const TrashItemCard = ({ item, selected, onToggleSelect, onRestore }: TrashItemCardProps) => {
  const { t } = useTranslation();
  const days = daysUntil(item.expires_at);

  return (
    <TrashCard variant="outlined">
      <Checkbox
        size="small"
        checked={selected}
        onChange={() => onToggleSelect(item.id)}
        slotProps={{ input: { 'aria-label': item.file_name } }}
        sx={{ p: 0.5 }}
      />

      {item.thumbnail_url ? (
        <CardThumb src={item.thumbnail_url} alt={item.file_name} />
      ) : (
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 1,
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ImageOutlinedIcon sx={{ fontSize: 22, color: 'text.disabled' }} />
        </Box>
      )}

      <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.5}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {item.file_name}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {t('kanban.trash.expiresIn', { days })}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 0.5 }}>
          <Button
            size="small"
            startIcon={<RestoreFromTrashOutlinedIcon sx={{ fontSize: 16 }} />}
            onClick={() => onRestore(item.design)}
          >
            {t('kanban.trash.restore')}
          </Button>
        </Box>
      </Stack>
    </TrashCard>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TrashViewProps {
  nicheId?: string;
}

const TrashView = ({ nicheId }: TrashViewProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { isMobile } = useResponsiveLayout();
  const { data, isLoading } = useListTrashQuery({});
  const [restore] = useRestoreDesignMutation();

  const items: DesignTrashItem[] = data?.results ?? [];

  // PROJ-30 T3.16 — selection state only used on `<sm`. Stored as a Set
  // of trash-item IDs (not design IDs) so toggling stays stable across
  // RTK Query re-renders.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleRestore = useCallback(
    async (designId: string) => {
      try {
        await restore({ designId, nicheId: nicheId ?? '' }).unwrap();
        enqueueSnackbar(t('kanban.trash.restoreSuccess'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('kanban.trash.restoreError'), { variant: 'error' });
      }
    },
    [restore, nicheId, enqueueSnackbar, t],
  );

  const handleBulkRestore = useCallback(async () => {
    const selected = items.filter((item) => selectedIds.has(item.id));
    let successes = 0;
    let failures = 0;
    for (const item of selected) {
      try {
        await restore({ designId: item.design, nicheId: nicheId ?? '' }).unwrap();
        successes += 1;
      } catch {
        failures += 1;
      }
    }
    setSelectedIds(new Set());
    if (successes > 0) {
      enqueueSnackbar(t('kanban.trash.restoreSuccess'), { variant: 'success' });
    }
    if (failures > 0) {
      enqueueSnackbar(t('kanban.trash.restoreError'), { variant: 'error' });
    }
  }, [items, selectedIds, restore, nicheId, enqueueSnackbar, t]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 1 }}>
        <DeleteForeverOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
        <Typography variant="body2" color="text.disabled">
          {t('kanban.trash.empty')}
        </Typography>
      </Box>
    );
  }

  // PROJ-30 T3.16 — card layout + bulk select on `<sm`; otherwise keep
  // the existing inline rows.
  if (isMobile) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          // Reserve space so the last card never hides under the sticky
          // bulk-action bar.
          pb: selectedIds.size > 0 ? 10 : 0,
        }}
      >
        {items.map((item) => (
          <TrashItemCard
            key={item.id}
            item={item}
            selected={selectedIds.has(item.id)}
            onToggleSelect={handleToggleSelect}
            onRestore={handleRestore}
          />
        ))}

        {selectedIds.size > 0 && (
          <BulkActionBar role="toolbar" aria-label={t('responsive.trash.selected', { count: selectedIds.size })}>
            <Typography variant="body2" color="text.secondary">
              {t('responsive.trash.selected', { count: selectedIds.size })}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={handleClearSelection}>
              {t('responsive.publishView.filtersClose')}
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<RestoreFromTrashOutlinedIcon sx={{ fontSize: 16 }} />}
              onClick={() => {
                void handleBulkRestore();
              }}
            >
              {t('responsive.trash.restore')}
            </Button>
          </BulkActionBar>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map((item) => (
        <TrashItemRow key={item.id} item={item} onRestore={handleRestore} />
      ))}
    </Box>
  );
};

export default TrashView;
