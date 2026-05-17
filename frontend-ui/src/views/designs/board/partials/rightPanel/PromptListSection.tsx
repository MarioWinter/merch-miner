import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { COLORS } from '@/style/constants';
import {
  useUpdatePromptMutation,
  useDeletePromptMutation,
  useGenerateFromPromptMutation,
} from '@/store/designSlice';
import type { ProjectPrompt } from '@/views/designs/gallery/types';
import type { BackgroundColor, DesignModel, GenerateFromPromptBody, GenerationMode } from '@/views/designs/board/types';
import type { AspectRatio } from '@/views/designs/board/partials/GenerationZone';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const SectionRoot = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
}));

const PromptCardRoot = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 8,
  padding: theme.spacing(1),
  cursor: 'pointer',
  '&:hover': {
    borderColor: alpha(COLORS.red, 0.3),
  },
}));

const GenerateAllButton = styled(Button)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.vars.palette.primary.main} 0%, ${theme.vars.palette.primary.dark} 100%)`,
  color: theme.vars.palette.common.white,
  fontWeight: 600,
  borderRadius: 8,
  '&.Mui-disabled': { opacity: 0.5 },
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface GenerationConfig {
  model: DesignModel;
  background_color: BackgroundColor;
  aspect_ratio: AspectRatio;
  mode: GenerationMode;
  source_image_url: string | null;
  source_image_url_2: string | null;
}

interface PromptListSectionProps {
  projectId: string;
  prompts: ProjectPrompt[];
  generationConfig: GenerationConfig;
  onPromptClick?: (prompt: ProjectPrompt) => void;
  onCreateSkeletonArtboards?: (
    items: Array<{ runId: string; label: string }>,
  ) => void;
}

// -----------------------------------------------------------------
// PromptCard
// -----------------------------------------------------------------

interface PromptCardProps {
  projectId: string;
  prompt: ProjectPrompt;
  generationConfig: GenerationConfig;
  onClick?: () => void;
}

const buildPromptBody = (cfg: GenerationConfig): GenerateFromPromptBody => ({
  model: cfg.model,
  background_color: cfg.background_color,
  aspect_ratio: cfg.aspect_ratio,
  mode: cfg.mode,
  ...(cfg.source_image_url ? { source_image_url: cfg.source_image_url } : {}),
  ...(cfg.source_image_url_2 ? { source_image_url_2: cfg.source_image_url_2 } : {}),
});

const PromptCard = ({ projectId, prompt, generationConfig, onClick }: PromptCardProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(prompt.prompt_text);

  const [updatePrompt] = useUpdatePromptMutation();
  const [deletePrompt] = useDeletePromptMutation();
  const [generateFromPrompt, { isLoading: isGenerating }] = useGenerateFromPromptMutation();

  const handleSave = async () => {
    try {
      await updatePrompt({
        projectId,
        promptId: prompt.id,
        prompt_text: editText,
      }).unwrap();
      setIsEditing(false);
    } catch {
      enqueueSnackbar(t('design.prompts.editError', 'Failed to update'), { variant: 'error' });
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deletePrompt({ projectId, promptId: prompt.id }).unwrap();
    } catch {
      enqueueSnackbar(t('design.prompts.deleteError', 'Failed to delete'), { variant: 'error' });
    }
  };

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await generateFromPrompt({
        projectId,
        promptId: prompt.id,
        body: buildPromptBody(generationConfig),
      }).unwrap();
      enqueueSnackbar(t('design.prompt.generating', 'Generating...'), { variant: 'info' });
    } catch {
      enqueueSnackbar(t('design.board.generateError'), { variant: 'error' });
    }
  };

  const sourceKeys = Object.entries(prompt.sources ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k);

  if (isEditing) {
    return (
      <PromptCardRoot>
        <TextField
          size="small"
          fullWidth
          multiline
          maxRows={4}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSave();
            } else if (e.key === 'Escape') {
              setIsEditing(false);
              setEditText(prompt.prompt_text);
            }
          }}
        />
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
          <IconButton size="small" onClick={() => void handleSave()}>
            <CheckIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              setIsEditing(false);
              setEditText(prompt.prompt_text);
            }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Stack>
      </PromptCardRoot>
    );
  }

  return (
    <PromptCardRoot onClick={onClick}>
      <Stack direction="row" alignItems="flex-start" spacing={0.5}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" noWrap sx={{ display: 'block' }}>
            {prompt.prompt_text}
          </Typography>

          {/* Source chips */}
          {sourceKeys.length > 0 && (
            <Stack direction="row" spacing={0.25} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
              {sourceKeys.map((key) => (
                <Chip
                  key={key}
                  label={key}
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: '0.55rem',
                    borderRadius: '4px',
                    backgroundColor: alpha(COLORS.cyan, 0.10),
                    color: 'secondary.main',
                  }}
                />
              ))}
            </Stack>
          )}

          {/* Source idea */}
          {prompt.source_idea && (
            <Typography variant="caption" color="text.disabled" noWrap sx={{ mt: 0.25, display: 'block' }}>
              {prompt.source_idea.slogan_text}
            </Typography>
          )}

          {/* Generated badge */}
          {prompt.is_generated && (
            <Chip
              label={t('design.prompts.generated', 'Generated')}
              size="small"
              color="success"
              sx={{ height: 16, fontSize: '0.55rem', borderRadius: '4px', mt: 0.5 }}
            />
          )}
        </Box>

        {/* Action buttons */}
        <Stack alignItems="center" spacing={0}>
          {!prompt.is_generated && (
            <Tooltip title={t('design.prompt.generate', 'Generate')}>
              <IconButton
                size="small"
                onClick={handleGenerate}
                disabled={isGenerating}
                sx={{ p: 0.5 }}
              >
                <AutoAwesomeIcon sx={{ fontSize: 14, color: 'primary.main' }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t('design.prompts.edit', 'Edit')}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              sx={{ p: 0.5 }}
            >
              <EditIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('design.prompts.delete', 'Delete')}>
            <IconButton
              size="small"
              onClick={handleDelete}
              sx={{ p: 0.5, color: 'text.disabled' }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </PromptCardRoot>
  );
};

// -----------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------

const PromptListSection = ({
  projectId,
  prompts,
  generationConfig,
  onPromptClick,
  onCreateSkeletonArtboards,
}: PromptListSectionProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [generateFromPrompt] = useGenerateFromPromptMutation();

  const ungeneratedPrompts = prompts.filter((p) => !p.is_generated);

  const handleGenerateAll = useCallback(async () => {
    try {
      const body = buildPromptBody(generationConfig);
      const results = await Promise.all(
        ungeneratedPrompts.map((p) =>
          generateFromPrompt({ projectId, promptId: p.id, body }).unwrap(),
        ),
      );

      // Gap 4: Create skeleton artboards for each generated prompt
      if (onCreateSkeletonArtboards && results.length > 0) {
        const skeletons = results.map((r, idx) => ({
          runId: r.id,
          label: `AI: ${ungeneratedPrompts[idx].prompt_text.slice(0, 30)}${ungeneratedPrompts[idx].prompt_text.length > 30 ? '\u2026' : ''}`,
        }));
        onCreateSkeletonArtboards(skeletons);
      }

      enqueueSnackbar(
        t('design.actions.bulkGenerating', 'Generating {{count}} designs...', {
          count: ungeneratedPrompts.length,
        }),
        { variant: 'info' },
      );
    } catch {
      enqueueSnackbar(t('design.board.generateError'), { variant: 'error' });
    }
  }, [ungeneratedPrompts, generateFromPrompt, projectId, enqueueSnackbar, t, onCreateSkeletonArtboards, generationConfig]);

  if (prompts.length === 0) {
    return (
      <SectionRoot>
        <Typography variant="caption" color="text.disabled">
          {t('design.prompts.empty', 'No saved prompts')}
        </Typography>
      </SectionRoot>
    );
  }

  return (
    <SectionRoot>
      <Stack spacing={1}>
        {prompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            projectId={projectId}
            prompt={prompt}
            generationConfig={generationConfig}
            onClick={() => onPromptClick?.(prompt)}
          />
        ))}

        {ungeneratedPrompts.length > 0 && (
          <GenerateAllButton
            size="small"
            fullWidth
            startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
            onClick={() => void handleGenerateAll()}
          >
            {t('design.prompts.generateAll', 'Generate All ({{count}})', {
              count: ungeneratedPrompts.length,
            })}
          </GenerateAllButton>
        )}
      </Stack>
    </SectionRoot>
  );
};

export default PromptListSection;
