import { useState, useCallback } from 'react';
import { Box, Checkbox, Chip, Link, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import { COLORS } from '@/style/constants';
import type { RootState } from '@/store';
import {
  selectCollectedKeywords,
  removeKeyword,
} from '@/store/collectedItemsSlice';
import { useListIdeasQuery, useUpdateIdeaMutation } from '@/store/ideaSlice';
import { InlineFlowButton, BulkFlowButton } from '@/components/FlowButton';
import { ProjectNamingDialog } from '@/views/designs/board/partials/ProjectNamingDialog';

interface CollectedItemsSectionProps {
  nicheId: string;
  nicheName?: string;
  nicheIdForProject?: string | null;
  onDrawerClose?: () => void;
}

export const CollectedItemsSection = ({
  nicheId,
  nicheName,
  nicheIdForProject,
  onDrawerClose,
}: CollectedItemsSectionProps) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [namingDialogOpen, setNamingDialogOpen] = useState(false);

  const { data: ideasData } = useListIdeasQuery(
    { nicheId, page_size: 100 },
    { skip: !nicheId },
  );
  const slogans = (ideasData?.results ?? [])
    .filter((i) => i.is_manual || i.status === 'approved')
    .map((i) => ({
      id: i.id,
      text: i.slogan_text,
      isApproved: i.status === 'approved',
      isSource: !i.source_idea,
      isSelectable: i.status === 'approved',
    }));

  const selectableSlogans = slogans.filter((s) => s.isSelectable);
  const keywords = useSelector((s: RootState) => selectCollectedKeywords(s, nicheId));
  const [updateIdea] = useUpdateIdeaMutation();

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(selectableSlogans.map((s) => s.id)));
  }, [selectableSlogans]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allSelected =
    selectableSlogans.length > 0 &&
    selectableSlogans.every((s) => selectedIds.has(s.id));

  const handleCopyAll = (items: string[]) => {
    navigator.clipboard.writeText(items.join(', '));
    enqueueSnackbar(t('niches.drawer.copiedAll'), { variant: 'success' });
  };

  const handleRemoveSlogan = async (ideaId: string) => {
    try {
      await updateIdea({ id: ideaId, body: { niche: null } }).unwrap();
    } catch {
      enqueueSnackbar(t('ideas.notifications.deleteError'), { variant: 'error' });
    }
  };

  const handleForge = () => {
    setNamingDialogOpen(true);
  };

  if (slogans.length === 0 && keywords.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
        {t('niches.drawer.slogansEmpty', 'No slogans yet')}
      </Typography>
    );
  }

  return (
    <>
      {/* Slogans */}
      {slogans.length > 0 && (
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="flex-end" sx={{ mb: 1 }}>
            {selectableSlogans.length > 0 && (
              <Link
                component="button"
                variant="caption"
                onClick={allSelected ? handleDeselectAll : handleSelectAll}
                underline="hover"
                sx={{ fontSize: '0.6875rem', mr: 1 }}
              >
                {allSelected
                  ? t('ideas.drawer.deselectAll', 'Deselect All')
                  : t('ideas.drawer.selectAll', 'Select All')}
              </Link>
            )}
            <Link
              component="button"
              variant="caption"
              onClick={() => handleCopyAll(slogans.map((s) => s.text))}
              underline="hover"
              sx={{ fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <ContentCopyIcon sx={{ fontSize: 12 }} />
              {t('niches.drawer.copyAll')}
            </Link>
          </Stack>

          <Stack spacing={0.5}>
            {slogans.map((slogan) => {
              const signalColor = slogan.isApproved
                ? COLORS.successDk
                : slogan.isSource
                  ? COLORS.red
                  : COLORS.cyan;

              return (
                <Stack
                  key={slogan.id}
                  direction="row"
                  alignItems="center"
                  spacing={0.75}
                  sx={{ minHeight: 32 }}
                >
                  {slogan.isSelectable && (
                    <Checkbox
                      size="small"
                      checked={selectedIds.has(slogan.id)}
                      onChange={() => toggleSelect(slogan.id)}
                      sx={{ p: 0.25, '& .MuiSvgIcon-root': { fontSize: 18 } }}
                      inputProps={{ 'aria-label': t('ideas.drawer.selectSlogan', 'Select slogan') }}
                    />
                  )}

                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    {slogan.text}
                  </Typography>

                  <Chip
                    size="small"
                    label={
                      slogan.isApproved
                        ? t('ideas.status.approved', 'Approved')
                        : slogan.isSource
                          ? t('ideas.status.source', 'Source')
                          : t('ideas.status.adapted', 'Adapted')
                    }
                    icon={slogan.isApproved ? <CheckCircleIcon sx={{ fontSize: 12 }} /> : undefined}
                    onDelete={() => handleRemoveSlogan(slogan.id)}
                    sx={{
                      height: 22,
                      fontSize: '0.6875rem',
                      backgroundColor: alpha(signalColor, 0.12),
                      color: signalColor,
                      borderRadius: '6px',
                      flexShrink: 0,
                      '& .MuiChip-icon': { color: signalColor },
                    }}
                  />

                  <InlineFlowButton
                    target="canvas"
                    tooltip={t('ideas.drawer.sendToCanvas', 'Send to Canvas')}
                    onClick={handleForge}
                  />
                </Stack>
              );
            })}
          </Stack>

          {/* Bulk forge action */}
          {selectedIds.size > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <BulkFlowButton
                target="canvas"
                label={t('ideas.drawer.forgeCount', 'Forge {{count}} → Design Canvas', {
                  count: selectedIds.size,
                })}
                count={selectedIds.size}
                onClick={handleForge}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Collected keywords */}
      {keywords.length > 0 && (
        <Box sx={{ mt: slogans.length > 0 ? 2 : 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="caption" fontWeight={600} color="text.secondary">
              {t('niches.drawer.collectedKeywords')}
            </Typography>
            <Link
              component="button"
              variant="caption"
              onClick={() => handleCopyAll(keywords)}
              underline="hover"
              sx={{ fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <ContentCopyIcon sx={{ fontSize: 12 }} />
              {t('niches.drawer.copyAll')}
            </Link>
          </Stack>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {keywords.map((keyword) => (
              <Chip
                key={keyword}
                label={keyword}
                size="small"
                onDelete={() => dispatch(removeKeyword({ nicheId, value: keyword }))}
                sx={(theme) => ({
                  backgroundColor: alpha(theme.palette.info.main, 0.12),
                  color: theme.vars.palette.info.main,
                  borderRadius: '6px',
                  mb: 0.5,
                  height: 22,
                  fontSize: '0.6875rem',
                })}
              />
            ))}
          </Stack>
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
        ideaIds={Array.from(selectedIds)}
      />
    </>
  );
};
