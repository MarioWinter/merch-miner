import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Slider,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { ProjectIdea, PromptPreset } from '../../gallery/types';
import type { SourceToggles } from '../hooks/usePromptBuilder';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const SourceSection = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 8,
  padding: theme.spacing(1.5),
  transition: `border-color ${DURATION.fast}ms ${EASING.standard}`,
}));

const SourceHeader = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}));

const PreviewBox = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 8,
  padding: theme.spacing(1.5),
  backgroundColor: alpha(COLORS.ink, 0.3),
  minHeight: 80,
  maxHeight: 160,
  overflowY: 'auto',
  fontFamily: '"Inter", sans-serif',
  fontSize: '0.8125rem',
  lineHeight: 1.55,
  color: theme.vars.palette.text.secondary,
  whiteSpace: 'pre-wrap',
  ...theme.applyStyles('light', {
    backgroundColor: alpha(COLORS.ash, 0.5),
  }),
}));

const BuildButton = styled(Button)(({ theme }) => ({
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

interface ResearchPreviewData {
  visual_style: string | null;
  graphic_elements: string | null;
  vibe: { energy_level: string; attitude: string; core_emotion: string } | null;
  tone: string | null;
  dominant_aesthetics: string | null;
}

interface PromptBuilderDialogProps {
  open: boolean;
  onClose: () => void;
  ideas: ProjectIdea[];
  // Source toggles + state from hook
  sources: SourceToggles;
  selectedSloganId: string | null;
  imageUrl: string | null;
  variants: number;
  preview: string[];
  isPreviewLoading: boolean;
  isSaving: boolean;
  hasNiche: boolean;
  presets: PromptPreset[];
  bulkSloganIds: string[];
  // Gap 5: keywords
  nicheKeywords: string[];
  // Gap 6: research data
  researchPreview: ResearchPreviewData | null;
  isResearchLoading: boolean;
  // Gap 7: image analysis
  onAnalyzeImage?: () => void;
  isAnalyzingImage?: boolean;
  imageAnalysisResult?: string | null;
  // Actions from hook
  toggleSource: (key: keyof SourceToggles) => void;
  setSelectedSloganId: (id: string | null) => void;
  setImageUrl: (url: string | null) => void;
  setVariants: (n: number) => void;
  fetchPreview: (
    sources: SourceToggles,
    sloganId: string | null,
    imageUrl: string | null,
    variants: number,
  ) => void;
  applyPreset: (config: Record<string, boolean>) => void;
  savePreset: (name: string) => Promise<void>;
  buildAndSave: () => Promise<void>;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const PromptBuilderDialog = ({
  open,
  onClose,
  ideas,
  sources,
  selectedSloganId,
  imageUrl,
  variants,
  preview,
  isPreviewLoading,
  isSaving,
  hasNiche,
  presets,
  bulkSloganIds,
  nicheKeywords,
  researchPreview,
  isResearchLoading,
  onAnalyzeImage,
  isAnalyzingImage,
  imageAnalysisResult,
  toggleSource,
  setSelectedSloganId,
  setImageUrl,
  setVariants,
  fetchPreview,
  applyPreset,
  savePreset,
  buildAndSave,
}: PromptBuilderDialogProps) => {
  const { t } = useTranslation();
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  const isBulk = bulkSloganIds.length > 1;
  const selectedIdea = ideas.find((i) => i.id === selectedSloganId);

  // Trigger preview fetch when sources/slogan/variants change
  useEffect(() => {
    if (!open) return;
    fetchPreview(sources, selectedSloganId, imageUrl, variants);
  }, [open, sources, selectedSloganId, imageUrl, variants, fetchPreview]);

  const handleBuild = async () => {
    await buildAndSave();
    onClose();
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    await savePreset(presetName.trim());
    setPresetName('');
    setShowSavePreset(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
  };

  const hasAnySources = Object.values(sources).some(Boolean);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="prompt-builder-title"
    >
      <DialogTitle id="prompt-builder-title" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
          {isBulk
            ? t('design.promptBuilder.titleBulk', 'Building prompts for {{count}} slogans', {
                count: bulkSloganIds.length,
              })
            : t('design.promptBuilder.title', 'Prompt Builder')}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label={t('common.close', 'Close')}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          {/* Preset selector */}
          {presets.length > 0 && (
            <FormControl size="small" fullWidth>
              <InputLabel>{t('design.presets.title', 'Presets')}</InputLabel>
              <Select
                label={t('design.presets.title', 'Presets')}
                value=""
                onChange={(e) => {
                  const preset = presets.find((p) => p.id === e.target.value);
                  if (preset) applyPreset(preset.source_config);
                }}
              >
                {presets.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* --- Slogan Section --- */}
          <SourceSection>
            <SourceHeader>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('design.promptBuilder.slogan', 'Slogan')}
              </Typography>
              <Switch
                size="small"
                checked={sources.slogan}
                onChange={() => toggleSource('slogan')}
              />
            </SourceHeader>
            {sources.slogan && !isBulk && (
              <Box sx={{ mt: 1 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>{t('design.promptBuilder.selectSlogan', 'Select slogan')}</InputLabel>
                  <Select
                    label={t('design.promptBuilder.selectSlogan', 'Select slogan')}
                    value={selectedSloganId ?? ''}
                    onChange={(e) => setSelectedSloganId(e.target.value || null)}
                  >
                    {ideas.map((idea) => (
                      <MenuItem key={idea.id} value={idea.id}>
                        {idea.slogan_text}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {selectedIdea && (
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                    {selectedIdea.signal_type && (
                      <Chip label={selectedIdea.signal_type} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
                    )}
                    {selectedIdea.emotional_archetype && (
                      <Chip
                        label={selectedIdea.emotional_archetype}
                        size="small"
                        color="secondary"
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                    )}
                    {selectedIdea.pattern_used && (
                      <Chip label={selectedIdea.pattern_used} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
                    )}
                  </Stack>
                )}
              </Box>
            )}
            {sources.slogan && isBulk && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('design.promptBuilder.bulkSelected', '{{count}} slogans selected', {
                  count: bulkSloganIds.length,
                })}
              </Typography>
            )}
          </SourceSection>

          {/* --- Keywords Section --- */}
          <SourceSection sx={{ opacity: hasNiche ? 1 : 0.5 }}>
            <SourceHeader>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('design.promptBuilder.keywords', 'Keywords')}
                {nicheKeywords.length > 0 && ` (${nicheKeywords.length})`}
              </Typography>
              <Switch
                size="small"
                checked={sources.keywords}
                onChange={() => toggleSource('keywords')}
                disabled={!hasNiche || nicheKeywords.length === 0}
              />
            </SourceHeader>
            {!hasNiche && (
              <Typography variant="caption" color="text.disabled">
                {t('design.promptBuilder.noNicheKeywords', 'Link a niche to enable keywords')}
              </Typography>
            )}
            {hasNiche && nicheKeywords.length === 0 && (
              <Typography variant="caption" color="text.disabled">
                {t('design.promptBuilder.noKeywordsFound', 'No keywords found for this niche')}
              </Typography>
            )}
            {sources.keywords && nicheKeywords.length > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                {nicheKeywords.slice(0, 20).map((kw) => (
                  <Chip
                    key={kw}
                    label={kw}
                    size="small"
                    sx={{ height: 22, fontSize: '0.7rem' }}
                  />
                ))}
                {nicheKeywords.length > 20 && (
                  <Chip
                    label={`+${nicheKeywords.length - 20}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 22, fontSize: '0.7rem' }}
                  />
                )}
              </Stack>
            )}
          </SourceSection>

          {/* --- AI Research Section --- */}
          <SourceSection sx={{ opacity: hasNiche ? 1 : 0.5 }}>
            <SourceHeader>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('design.promptBuilder.research', 'AI Research')}
              </Typography>
              <Switch
                size="small"
                checked={sources.research}
                onChange={() => toggleSource('research')}
                disabled={!hasNiche || (!researchPreview && !isResearchLoading)}
              />
            </SourceHeader>
            {!hasNiche && (
              <Typography variant="caption" color="text.disabled">
                {t('design.promptBuilder.noResearch', 'No research data available')}
              </Typography>
            )}
            {hasNiche && !researchPreview && !isResearchLoading && (
              <Typography variant="caption" color="text.disabled">
                {t('design.promptBuilder.noResearchData', 'Run AI Research first to enable this source')}
              </Typography>
            )}
            {isResearchLoading && (
              <Skeleton variant="text" width="60%" sx={{ mt: 0.5 }} />
            )}
            {sources.research && researchPreview && (
              <Box sx={{ mt: 1 }}>
                {researchPreview.visual_style && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                    <strong>{t('design.promptBuilder.visualStyle', 'Visual Style')}:</strong>{' '}
                    {researchPreview.visual_style}
                  </Typography>
                )}
                {researchPreview.graphic_elements && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                    <strong>{t('design.promptBuilder.graphicElements', 'Graphics')}:</strong>{' '}
                    {researchPreview.graphic_elements}
                  </Typography>
                )}
                {researchPreview.vibe && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                    <strong>{t('design.promptBuilder.vibe', 'Vibe')}:</strong>{' '}
                    {researchPreview.vibe.energy_level} / {researchPreview.vibe.attitude} / {researchPreview.vibe.core_emotion}
                  </Typography>
                )}
                {researchPreview.tone && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                    <strong>{t('design.promptBuilder.tone', 'Tone')}:</strong>{' '}
                    {researchPreview.tone}
                  </Typography>
                )}
                {researchPreview.dominant_aesthetics && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    <strong>{t('design.promptBuilder.aesthetics', 'Aesthetics')}:</strong>{' '}
                    {researchPreview.dominant_aesthetics}
                  </Typography>
                )}
              </Box>
            )}
          </SourceSection>

          {/* --- Web Research Section --- */}
          <SourceSection sx={{ opacity: 0.5 }}>
            <SourceHeader>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('design.promptBuilder.webResearch', 'Web Research')}
              </Typography>
              <Switch size="small" checked={false} disabled />
            </SourceHeader>
            <Typography variant="caption" color="text.disabled">
              {t('design.promptBuilder.notAvailable', 'Not available -- run Deep Web Search first')}
            </Typography>
          </SourceSection>

          {/* --- Reference Image Section --- */}
          <SourceSection>
            <SourceHeader>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('design.promptBuilder.image', 'Reference Image')}
              </Typography>
              <Switch
                size="small"
                checked={sources.image}
                onChange={() => toggleSource('image')}
              />
            </SourceHeader>
            {sources.image && (
              <Box sx={{ mt: 1 }}>
                <Button variant="outlined" component="label" size="small">
                  {t('design.promptBuilder.uploadImage', 'Upload Image')}
                  <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                </Button>
                {imageUrl && (
                  <Box sx={{ mt: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box
                        component="img"
                        src={imageUrl}
                        alt="Reference"
                        sx={{ width: 48, height: 48, borderRadius: 1, objectFit: 'cover' }}
                      />
                      {onAnalyzeImage && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={onAnalyzeImage}
                          disabled={isAnalyzingImage}
                          startIcon={
                            isAnalyzingImage ? (
                              <CircularProgress size={14} color="inherit" />
                            ) : (
                              <AutoAwesomeIcon sx={{ fontSize: 14 }} />
                            )
                          }
                        >
                          {t('design.promptBuilder.analyzeImage', 'Analyze')}
                        </Button>
                      )}
                      <IconButton size="small" onClick={() => setImageUrl(null)}>
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Stack>
                    {imageAnalysisResult && (
                      <PreviewBox sx={{ mt: 1 }}>
                        {imageAnalysisResult}
                      </PreviewBox>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </SourceSection>

          {/* --- Variants slider --- */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {t('design.promptBuilder.variants', 'Variants')}: {variants}
            </Typography>
            <Slider
              value={variants}
              onChange={(_, v) => setVariants(v as number)}
              min={1}
              max={5}
              step={1}
              marks
              valueLabelDisplay="auto"
              size="small"
            />
          </Box>

          {/* --- Preview --- */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {t('design.promptBuilder.preview', 'Prompt Preview')}
            </Typography>
            <PreviewBox>
              {isPreviewLoading ? (
                <Stack spacing={1}>
                  <Skeleton variant="text" width="90%" />
                  <Skeleton variant="text" width="70%" />
                  <Skeleton variant="text" width="80%" />
                </Stack>
              ) : preview.length > 0 ? (
                preview.map((text, idx) => (
                  <Box key={idx} sx={{ mb: idx < preview.length - 1 ? 1.5 : 0 }}>
                    {variants > 1 && (
                      <Typography variant="overline" color="text.disabled" sx={{ display: 'block', mb: 0.25 }}>
                        {t('design.promptBuilder.variantLabel', 'Variant {{n}}', { n: idx + 1 })}
                      </Typography>
                    )}
                    {text}
                  </Box>
                ))
              ) : (
                <Typography variant="caption" color="text.disabled">
                  {t('design.promptBuilder.noPreview', 'Toggle sources to see a preview')}
                </Typography>
              )}
            </PreviewBox>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1}>
          {showSavePreset ? (
            <>
              <TextField
                size="small"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder={t('design.presets.namePlaceholder', 'Preset name')}
                sx={{ width: 160 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSavePreset();
                  if (e.key === 'Escape') setShowSavePreset(false);
                }}
                autoFocus
              />
              <Button size="small" onClick={() => void handleSavePreset()}>
                {t('common.save', 'Save')}
              </Button>
              <Button size="small" onClick={() => setShowSavePreset(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
            </>
          ) : (
            <Tooltip title={t('design.presets.save', 'Save as Preset')}>
              <IconButton size="small" onClick={() => setShowSavePreset(true)}>
                <SaveOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        <BuildButton
          startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
          onClick={() => void handleBuild()}
          disabled={isSaving || !hasAnySources}
        >
          {isBulk
            ? t('design.promptBuilder.buildBulk', 'Build {{count}} Prompt(s)', {
                count: bulkSloganIds.length * variants,
              })
            : t('design.promptBuilder.build', 'Build Prompt(s)')}
        </BuildButton>
      </DialogActions>
    </Dialog>
  );
};

export default PromptBuilderDialog;
