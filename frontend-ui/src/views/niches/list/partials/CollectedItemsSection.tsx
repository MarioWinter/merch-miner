import { useState, useCallback } from 'react';
import { Box, Button, Checkbox, Chip, Link, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BrushIcon from '@mui/icons-material/Brush';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import { COLORS } from '@/style/constants';
import type { RootState } from '@/store';
import {
  selectCollectedKeywords,
  removeKeyword,
} from '@/store/collectedItemsSlice';
import { useListIdeasQuery, useDeleteIdeaMutation } from '@/store/ideaSlice';
import { ProjectNamingDialog } from '@/views/designs/board/partials/ProjectNamingDialog';

interface CollectedItemsSectionProps {
  nicheId: string;
  nicheName?: string;
  nicheIdForProject?: string | null;
  onDrawerClose?: () => void;
}

const Section = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: 16,
  background: alpha(COLORS.inkPaper, 0.40),
}));

const ForgeButton = styled(Button)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.vars.palette.primary.main} 0%, ${theme.vars.palette.primary.dark} 100%)`,
  color: theme.vars.palette.common.white,
  fontWeight: 600,
  borderRadius: 8,
  '&:hover': {
    background: `linear-gradient(135deg, ${theme.vars.palette.primary.dark} 0%, ${theme.vars.palette.primary.main} 100%)`,
  },
}));

export const CollectedItemsSection = ({
  nicheId,
  nicheName,
  nicheIdForProject,
  onDrawerClose,
}: CollectedItemsSectionProps) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [namingDialogOpen, setNamingDialogOpen] = useState(false);

  // API-backed slogans (ideas with is_manual=true for this niche)
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

  // Redux-only keywords
  const keywords = useSelector((s: RootState) => selectCollectedKeywords(s, nicheId));

  const [deleteIdea] = useDeleteIdeaMutation();

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = selectableSlogans.map((s) => s.id);
    setSelectedIds(new Set(allIds));
  }, [selectableSlogans]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allSelected = selectableSlogans.length > 0 &&
    selectableSlogans.every((s) => selectedIds.has(s.id));

  if (slogans.length === 0 && keywords.length === 0) return null;

  const handleCopyAll = (items: string[]) => {
    navigator.clipboard.writeText(items.join(', '));
    enqueueSnackbar(t('niches.drawer.copiedAll'), { variant: 'success' });
  };

  const handleRemoveSlogan = async (ideaId: string) => {
    try {
      await deleteIdea({ id: ideaId }).unwrap();
    } catch {
      enqueueSnackbar(t('ideas.notifications.deleteError'), { variant: 'error' });
    }
  };

  const handleForge = () => {
    setNamingDialogOpen(true);
  };

  return (
    <Section>
      {slogans.length > 0 && (
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ color: COLORS.snow }}>
              {t('niches.drawer.collectedSlogans')}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {selectableSlogans.length > 0 && (
                <Link
                  component="button"
                  variant="caption"
                  onClick={allSelected ? handleDeselectAll : handleSelectAll}
                  underline="hover"
                  sx={{ fontSize: '0.6875rem' }}
                >
                  {allSelected
                    ? t('ideas.drawer.deselectAll', 'Deselect All')
                    : t('ideas.drawer.selectAll', 'Select All')}
                </Link>
              )}
              <Button
                size="small"
                startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                onClick={() => handleCopyAll(slogans.map((s) => s.text))}
                sx={{ fontSize: '0.75rem', textTransform: 'none' }}
              >
                {t('niches.drawer.copyAll')}
              </Button>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {slogans.map((slogan) => {
              const chipColor = slogan.isApproved
                ? COLORS.successDk
                : slogan.isSource
                  ? COLORS.red
                  : COLORS.cyan;
              const chipTextColor = slogan.isApproved
                ? 'success.main'
                : slogan.isSource
                  ? 'primary.main'
                  : 'secondary.main';

              return (
                <Stack key={slogan.id} direction="row" alignItems="center" spacing={0}>
                  {slogan.isSelectable && (
                    <Checkbox
                      size="small"
                      checked={selectedIds.has(slogan.id)}
                      onChange={() => toggleSelect(slogan.id)}
                      sx={{ p: 0.25 }}
                      aria-label={t('ideas.drawer.selectSlogan', 'Select slogan')}
                    />
                  )}
                  <Chip
                    label={slogan.text}
                    size="small"
                    icon={slogan.isApproved ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : undefined}
                    onDelete={() => handleRemoveSlogan(slogan.id)}
                    sx={{
                      backgroundColor: alpha(chipColor, 0.12),
                      color: chipTextColor,
                      borderRadius: '6px',
                      mb: 0.5,
                      '& .MuiChip-icon': { color: 'success.main' },
                    }}
                  />
                </Stack>
              );
            })}
          </Stack>

          {/* Action bar: Forge N Slogans */}
          {selectedIds.size > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <ForgeButton
                size="small"
                startIcon={<BrushIcon sx={{ fontSize: 16 }} />}
                onClick={handleForge}
                fullWidth
              >
                {t('ideas.drawer.forgeCount', 'Forge {{count}} Slogans', {
                  count: selectedIds.size,
                })}
              </ForgeButton>
            </Box>
          )}
        </Box>
      )}

      {keywords.length > 0 && (
        <Box sx={{ mt: slogans.length > 0 ? 2 : 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ color: COLORS.snow }}>
              {t('niches.drawer.collectedKeywords')}
            </Typography>
            <Button
              size="small"
              startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
              onClick={() => handleCopyAll(keywords)}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              {t('niches.drawer.copyAll')}
            </Button>
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
    </Section>
  );
};
