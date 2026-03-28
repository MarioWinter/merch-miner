import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';

import { useBoardContext } from './hooks/useBoardContext';
import { useGeneration } from './hooks/useGeneration';
import { useDesignActions } from './hooks/useDesignActions';
import { useBatchProcess } from './hooks/useBatchProcess';
import { ReferencePanel } from './partials/ReferencePanel';
import { PromptEditor } from './partials/PromptEditor';
import { ModelSelector } from './partials/ModelSelector';
import { BackgroundColorPicker } from './partials/BackgroundColorPicker';
import { GenerationProgress } from './partials/GenerationProgress';
import { DesignGallery } from './partials/DesignGallery';
import { BatchProcessPanel } from './partials/BatchProcessPanel';
import type { BackgroundColor, DesignModel } from './types';

const PageHeader = styled(Stack)(({ theme }) => ({
  marginBottom: theme.spacing(3),
}));

const SidePanel = styled(Box)(({ theme }) => ({
  borderRadius: 12,
  border: `1px solid rgba(255,255,255,0.08)`,
  padding: theme.spacing(2),
  height: 'fit-content',
  maxHeight: 'calc(100vh - 140px)',
  overflowY: 'auto',
  ...theme.applyStyles('light', {
    border: `1px solid rgba(7,30,38,0.08)`,
  }),
}));

export const DesignBoardView = () => {
  const { ideaId } = useParams<{ ideaId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<DesignModel>('gemini_flash');
  const [bgColor, setBgColor] = useState<BackgroundColor>('light_gray');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [promptAnalysis] = useState<
    Record<string, unknown>
  >({});

  // Hooks
  const {
    sloganText,
    nicheName,
    referenceProducts,
    designs,
    isLoading,
    isError,
  } = useBoardContext(ideaId ?? '');

  const { trigger, isGenerating, currentRun } = useGeneration(ideaId ?? '');
  const { approve, reject, remove } = useDesignActions(ideaId ?? '');
  const {
    trigger: processBatch,
    isProcessing,
    totalJobs,
    completedCount,
  } = useBatchProcess();

  // Handlers
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      enqueueSnackbar(t('design.board.promptRequired'), { variant: 'warning' });
      return;
    }
    try {
      await trigger({ model, background_color: bgColor, prompt: prompt.trim() });
    } catch {
      enqueueSnackbar(t('design.board.generateError'), { variant: 'error' });
    }
  }, [trigger, model, bgColor, prompt, enqueueSnackbar, t]);

  const handleAnalyzeImage = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_imageUrl: string) => {
      enqueueSnackbar(t('design.analyze.started'), { variant: 'info' });
      // Analysis results will populate prompt via polling (future enhancement)
    },
    [enqueueSnackbar, t],
  );

  const handleSelectPrompt = useCallback((newPrompt: string) => {
    setPrompt(newPrompt);
  }, []);

  const handleDownload = useCallback(
    (designId: string) => {
      const design = designs.find((d) => d.id === designId);
      if (design?.image_file) {
        window.open(design.image_file, '_blank');
      }
    },
    [designs],
  );

  const handleToggleSelect = useCallback((designId: string) => {
    setSelectedIds((prev) =>
      prev.includes(designId)
        ? prev.filter((id) => id !== designId)
        : [...prev, designId],
    );
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={40} />
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12, md: 3 }}>
            <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  // Error state
  if (isError || !ideaId) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">{t('design.board.loadError')}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mt: 2 }}
        >
          {t('design.board.goBack')}
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Page Header */}
      <PageHeader direction="row" alignItems="center" spacing={2}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          size="small"
        >
          {t('design.board.goBack')}
        </Button>
        <Typography variant="h4" sx={{ flex: 1 }}>
          {t('design.board.title')}
        </Typography>
        {nicheName && (
          <Chip label={nicheName} size="small" variant="outlined" />
        )}
      </PageHeader>

      {/* Slogan banner */}
      {sloganText && (
        <Typography
          variant="h5"
          sx={{ mb: 3, fontStyle: 'italic', color: 'text.secondary' }}
        >
          &ldquo;{sloganText}&rdquo;
        </Typography>
      )}

      {/* Main 3-column layout */}
      <Grid container spacing={3}>
        {/* Left: Reference Panel */}
        <Grid size={{ xs: 12, md: 3 }}>
          <SidePanel>
            <ReferencePanel
              products={referenceProducts}
              isLoading={false}
              onAnalyzeImage={handleAnalyzeImage}
              onSelectPrompt={handleSelectPrompt}
            />
          </SidePanel>
        </Grid>

        {/* Center: Prompt + Controls + Generation */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2}>
            <PromptEditor
              value={prompt}
              onChange={setPrompt}
              promptAnalysis={promptAnalysis}
              disabled={isGenerating}
            />

            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Box sx={{ flex: 1 }}>
                <ModelSelector
                  value={model}
                  onChange={setModel}
                  disabled={isGenerating}
                />
              </Box>
              <BackgroundColorPicker
                value={bgColor}
                onChange={setBgColor}
                disabled={isGenerating}
              />
            </Stack>

            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              fullWidth
              sx={{
                background: 'linear-gradient(135deg, #FF5A4F 0%, #E84B42 100%)',
              }}
            >
              {isGenerating
                ? t('design.board.generating')
                : t('design.board.generate')}
            </Button>

            <GenerationProgress
              run={currentRun}
              isGenerating={isGenerating}
              onRetry={handleGenerate}
            />
          </Stack>
        </Grid>

        {/* Right: Gallery */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2}>
            <Typography variant="h6">{t('design.gallery.title')}</Typography>

            <BatchProcessPanel
              selectedCount={selectedIds.length}
              selectedIds={selectedIds}
              isProcessing={isProcessing}
              totalJobs={totalJobs}
              completedCount={completedCount}
              onProcess={processBatch}
            />

            <DesignGallery
              designs={designs}
              onApprove={approve}
              onReject={reject}
              onDownload={handleDownload}
              onDelete={remove}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
            />
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DesignBoardView;
