import { useState, useCallback } from 'react';
import { Box, Checkbox, Chip, Link, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { COLORS, DURATION, EASING, radius } from "@/style/constants";
import { useListIdeasQuery, useUpdateIdeaMutation } from '@/store/ideaSlice';
import { InlineFlowButton, BulkFlowButton } from '@/components/FlowButton';
import { ProjectNamingDialog } from '@/views/designs/board/partials/ProjectNamingDialog';

// ── Props ──────────────────────────────────────────────────────────
interface SlogansPipelineContentProps {
  nicheId: string;
  nicheName?: string;
  nicheIdForProject?: string | null;
  onDrawerClose?: () => void;
}

// ── Styled ─────────────────────────────────────────────────────────
const SloganRow = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  padding: theme.spacing(0.5, 0),
  borderRadius: radius(theme, 0.75),
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.04),
  },
  ...theme.applyStyles('light', {
    '&:hover': {
      backgroundColor: alpha(theme.palette.common.black, 0.04),
    },
  }),
}));

// ── Component ──────────────────────────────────────────────────────
export const SlogansPipelineContent = ({
  nicheId,
  nicheName,
  nicheIdForProject,
  onDrawerClose,
}: SlogansPipelineContentProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [namingDialogOpen, setNamingDialogOpen] = useState(false);

  const { data: ideasData } = useListIdeasQuery(
    { nicheId, page_size: 100 },
    { skip: !nicheId },
  );
  const [updateIdea] = useUpdateIdeaMutation();

  const slogans = (ideasData?.results ?? [])
    .filter((i) => i.is_manual || i.status === 'approved')
    .map((i) => ({
      id: i.id,
      text: i.slogan_text,
      signalType: i.signal_type,
      isApproved: i.status === 'approved',
      // Manual ideas (added from the niche-research chip click) are
      // selectable too — users expect a checkbox so they can bulk-promote
      // to design projects without first approving each one.
      isSelectable: i.is_manual || i.status === 'approved',
    }));

  const selectableSlogans = slogans.filter((s) => s.isSelectable);
  const allSelected =
    selectableSlogans.length > 0 &&
    selectableSlogans.every((s) => selectedIds.has(s.id));

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableSlogans.map((s) => s.id)));
    }
  };

  const handleRemoveSlogan = async (ideaId: string) => {
    try {
      await updateIdea({ id: ideaId, body: { niche: null } }).unwrap();
    } catch {
      enqueueSnackbar(t('ideas.notifications.deleteError'), { variant: 'error' });
    }
  };

  const [forgeIds, setForgeIds] = useState<string[]>([]);

  const handleForgeSingle = (ideaId: string) => {
    setForgeIds([ideaId]);
    setNamingDialogOpen(true);
  };

  const handleForgeBulk = () => {
    setForgeIds(Array.from(selectedIds));
    setNamingDialogOpen(true);
  };

  if (slogans.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('niches.pipeline.slogans.empty', 'No slogans collected yet')}
      </Typography>
    );
  }

  return (
    <Box>
      {/* Select All toggle */}
      {selectableSlogans.length > 0 && (
        <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
          <Checkbox
            size="small"
            checked={allSelected}
            indeterminate={selectedIds.size > 0 && !allSelected}
            onChange={handleSelectAll}
            sx={{ p: 0.25, mr: 0.5 }}
            aria-label={t('ideas.drawer.selectAll', 'Select All')}
          />
          <Link
            component="button"
            variant="caption"
            onClick={handleSelectAll}
            underline="hover"
            sx={{ color: 'text.secondary' }}
          >
            {allSelected
              ? t('ideas.drawer.deselectAll', 'Deselect All')
              : t('ideas.drawer.selectAll', 'Select All')}
          </Link>
        </Stack>
      )}

      {/* Slogan rows */}
      <Stack spacing={0.25}>
        {slogans.map((slogan) => (
          <SloganRow key={slogan.id} direction="row" spacing={1}>
            {slogan.isSelectable && (
              <Checkbox
                size="small"
                checked={selectedIds.has(slogan.id)}
                onChange={() => toggleSelect(slogan.id)}
                sx={{ p: 0.25 }}
                aria-label={t('ideas.drawer.selectSlogan', 'Select slogan')}
              />
            )}

            {/* Slogan text */}
            <Typography
              variant="body2"
              noWrap
              sx={{ flex: 1, minWidth: 0 }}
            >
              {slogan.text}
            </Typography>

            {/* Signal badge */}
            {slogan.signalType && (
              <Chip
                label={slogan.signalType.toUpperCase()}
                size="small"
                icon={slogan.isApproved ? <CheckCircleIcon sx={{ fontSize: 12 }} /> : undefined}
                sx={{
                  height: 20,
                  fontSize: '0.6875rem',
                  backgroundColor: slogan.signalType === 'self'
                    ? alpha(COLORS.red, 0.12)
                    : alpha(COLORS.cyan, 0.12),
                  color: slogan.signalType === 'self'
                    ? 'primary.main'
                    : 'secondary.main',
                  '& .MuiChip-icon': {
                    color: 'success.main',
                  },
                }}
                onDelete={() => handleRemoveSlogan(slogan.id)}
              />
            )}

            {!slogan.signalType && slogan.isApproved && (
              <Chip
                label={t('ideas.status.approved', 'Approved')}
                size="small"
                icon={<CheckCircleIcon sx={{ fontSize: 12 }} />}
                sx={{
                  height: 20,
                  fontSize: '0.6875rem',
                  backgroundColor: alpha(COLORS.successDk, 0.12),
                  color: 'success.main',
                  '& .MuiChip-icon': { color: 'success.main' },
                }}
                onDelete={() => handleRemoveSlogan(slogan.id)}
              />
            )}

            {/* Flow to canvas */}
            <InlineFlowButton
              target="canvas"
              tooltip={t('niches.pipeline.slogans.toCanvas', 'Send to Design Canvas')}
              onClick={() => handleForgeSingle(slogan.id)}
            />
          </SloganRow>
        ))}
      </Stack>

      {/* Bulk action: Forge N -> Design Canvas */}
      {selectedIds.size > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <BulkFlowButton
            target="canvas"
            label={t('niches.pipeline.slogans.forgeSelected', 'Forge {{count}} to Canvas', {
              count: selectedIds.size,
            })}
            count={selectedIds.size}
            onClick={handleForgeBulk}
          />
        </Box>
      )}

      {/* Project naming dialog for forge */}
      <ProjectNamingDialog
        open={namingDialogOpen}
        onClose={() => {
          setNamingDialogOpen(false);
          setSelectedIds(new Set());
        }}
        onProjectSelected={() => {
          setNamingDialogOpen(false);
          setSelectedIds(new Set());
          onDrawerClose?.();
        }}
        nicheName={nicheName}
        nicheId={nicheIdForProject}
        ideaIds={forgeIds}
      />
    </Box>
  );
};
