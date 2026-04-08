import { useState, useCallback } from 'react';
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { COLORS } from '@/style/constants';
import {
  useRemoveIdeaFromProjectMutation,
  useLazyAutoPromptQuery,
  useBulkGenerateDesignsMutation,
} from '@/store/designSlice';
import type { ProjectIdea } from '@/views/designs/gallery/types';
import type { BackgroundColor, DesignModel } from '../../types';
import SloganPoolCard from './SloganPoolCard';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const SectionRoot = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
}));

const GenerateButton = styled(Button)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.vars.palette.primary.main} 0%, ${theme.vars.palette.primary.dark} 100%)`,
  color: theme.vars.palette.common.white,
  fontWeight: 600,
  borderRadius: 8,
  '&:hover': {
    background: `linear-gradient(135deg, ${theme.vars.palette.primary.dark} 0%, ${theme.vars.palette.primary.main} 100%)`,
    boxShadow: `0 0 16px ${alpha(COLORS.red, 0.35)}`,
  },
  '&.Mui-disabled': { opacity: 0.5 },
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface SloganPoolSectionProps {
  projectId: string;
  ideas: ProjectIdea[];
  model: DesignModel;
  bgColor: BackgroundColor;
  onAutoPromptFill?: (prompt: string) => void;
  onAddReferenceArtboard?: (imageUrl: string) => void;
  onCreateSkeletonArtboards?: (
    items: Array<{ runId: string; label: string }>,
  ) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const SloganPoolSection = ({
  projectId,
  ideas,
  model,
  bgColor,
  onAutoPromptFill,
  onAddReferenceArtboard,
  onCreateSkeletonArtboards,
}: SloganPoolSectionProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [autoPromptingId, setAutoPromptingId] = useState<string | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());

  const [removeIdea] = useRemoveIdeaFromProjectMutation();
  const [triggerAutoPrompt] = useLazyAutoPromptQuery();
  const [bulkGenerate] = useBulkGenerateDesignsMutation();

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleRemove = useCallback(
    async (ideaId: string) => {
      try {
        await removeIdea({ projectId, ideaId }).unwrap();
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(ideaId);
          return next;
        });
      } catch {
        enqueueSnackbar(t('design.sloganPool.removeError', 'Failed to remove'), {
          variant: 'error',
        });
      }
    },
    [removeIdea, projectId, enqueueSnackbar, t],
  );

  const handleAutoPrompt = useCallback(
    async (ideaId: string) => {
      setAutoPromptingId(ideaId);
      try {
        const result = await triggerAutoPrompt({ projectId, ideaId }).unwrap();
        onAutoPromptFill?.(result.prompt);
      } catch {
        enqueueSnackbar(t('design.sloganPool.autoPromptError', 'Auto-prompt failed'), {
          variant: 'error',
        });
      } finally {
        setAutoPromptingId(null);
      }
    },
    [triggerAutoPrompt, projectId, onAutoPromptFill, enqueueSnackbar, t],
  );

  const handleBulkGenerate = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || ids.length > 10) return;

    setGeneratingIds(new Set(ids));
    try {
      const results = await bulkGenerate({
        projectId,
        body: { idea_ids: ids, model, background_color: bgColor },
      }).unwrap();

      // Gap 1: Create skeleton artboards on canvas
      if (onCreateSkeletonArtboards && results.length > 0) {
        const skeletons = results.map((r) => ({
          runId: r.run_id,
          label: `AI: ${r.prompt_used.slice(0, 30)}${r.prompt_used.length > 30 ? '\u2026' : ''}`,
        }));
        onCreateSkeletonArtboards(skeletons);
      }

      enqueueSnackbar(
        t('design.actions.bulkGenerating', 'Generating {{count}} designs...', {
          count: ids.length,
        }),
        { variant: 'info' },
      );
    } catch {
      enqueueSnackbar(t('design.board.generateError'), { variant: 'error' });
    } finally {
      setGeneratingIds(new Set());
    }
  }, [selectedIds, bulkGenerate, projectId, model, bgColor, enqueueSnackbar, t, onCreateSkeletonArtboards]);

  if (ideas.length === 0) {
    return (
      <SectionRoot>
        <Typography variant="caption" color="text.disabled">
          {t(
            'design.sloganPool.empty',
            'No slogans -- add from Slogan Refinery or Niche Drawer',
          )}
        </Typography>
      </SectionRoot>
    );
  }

  return (
    <SectionRoot>
      <Stack spacing={1}>
        {ideas.map((idea) => (
          <SloganPoolCard
            key={idea.id}
            idea={idea}
            isSelected={selectedIds.has(idea.id)}
            onToggleSelect={() => toggleSelect(idea.id)}
            onAutoPrompt={() => handleAutoPrompt(idea.id)}
            onRemove={() => handleRemove(idea.id)}
            onAddReferenceArtboard={onAddReferenceArtboard}
            isAutoPrompting={autoPromptingId === idea.id}
            isGenerating={generatingIds.has(idea.id)}
          />
        ))}

        {/* Bulk generate button */}
        <Tooltip
          title={
            selectedIds.size > 10
              ? t('design.sloganPool.maxBulk', 'Max 10 per batch')
              : ''
          }
        >
          <span>
            <GenerateButton
              size="small"
              fullWidth
              startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
              onClick={() => void handleBulkGenerate()}
              disabled={selectedIds.size === 0 || selectedIds.size > 10}
            >
              {t('design.sloganPool.generateSelected', 'Generate Selected ({{count}})', {
                count: selectedIds.size,
              })}
            </GenerateButton>
          </span>
        </Tooltip>
      </Stack>
    </SectionRoot>
  );
};

export default SloganPoolSection;
