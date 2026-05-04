import { useCallback } from 'react';
import {
  Box,
  Checkbox,
  Collapse,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import { useTranslation } from 'react-i18next';
import type { ProjectReference } from '@/views/designs/gallery/types';
import {
  SectionCard,
  SectionHeader,
  KeywordChip,
  ResearchRow,
  ResearchLabel,
  ProductThumb,
  ReferenceRow,
  ReferenceThumb,
  AnalysisPreview,
} from './ContextTab.styles';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface ResearchFields {
  visualStyle: boolean;
  vibe: boolean;
  tone: boolean;
  elements: boolean;
  aesthetics: boolean;
  layout: boolean;
}

/** Per-reference toggle state */
export type ReferenceMode = 'image' | 'text';

export interface ReferenceToggle {
  referenceId: string;
  enabled: boolean;
  mode: ReferenceMode;
}

export interface ContextTabState {
  keywordsEnabled: boolean;
  selectedKeywords: string[];
  researchEnabled: boolean;
  researchFields: ResearchFields;
  productsEnabled: boolean;
  selectedProductIds: string[];
  /** Per-reference enabled/mode toggles */
  referenceToggles: ReferenceToggle[];
}

interface ResearchPreviewData {
  visual_style: string | null;
  graphic_elements: string | null;
  vibe: { energy_level: string; attitude: string; core_emotion: string } | null;
  tone: string | null;
  dominant_aesthetics: string | null;
  layout_composition?: string | null;
}

interface ReferenceProduct {
  id: string;
  thumbnail_url: string;
  title: string;
}

interface ContextTabProps {
  state: ContextTabState;
  keywords: string[];
  researchPreview: ResearchPreviewData | null;
  isResearchLoading: boolean;
  referenceProducts: ReferenceProduct[];
  references: ProjectReference[];
  isMultimodalModel: boolean;
  onChange: (patch: Partial<ContextTabState>) => void;
  onResearchFieldChange: (field: keyof ResearchFields, value: boolean) => void;
  onReferenceToggle: (referenceId: string, enabled: boolean) => void;
  onReferenceModeChange: (referenceId: string, mode: ReferenceMode) => void;
}

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const RESEARCH_FIELD_KEYS: Array<{
  key: keyof ResearchFields;
  labelKey: string;
  dataKey: keyof ResearchPreviewData;
}> = [
  { key: 'visualStyle', labelKey: 'visualStyle', dataKey: 'visual_style' },
  { key: 'vibe', labelKey: 'vibe', dataKey: 'vibe' },
  { key: 'tone', labelKey: 'tone', dataKey: 'tone' },
  { key: 'elements', labelKey: 'elements', dataKey: 'graphic_elements' },
  { key: 'aesthetics', labelKey: 'aesthetics', dataKey: 'dominant_aesthetics' },
  { key: 'layout', labelKey: 'layout', dataKey: 'layout_composition' },
];

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ContextTab = ({
  state,
  keywords,
  researchPreview,
  isResearchLoading,
  referenceProducts,
  references,
  isMultimodalModel,
  onChange,
  onResearchFieldChange,
  onReferenceToggle,
  onReferenceModeChange,
}: ContextTabProps) => {
  const { t } = useTranslation();

  // -- Keywords --
  const handleKeywordToggle = useCallback(
    (kw: string) => {
      const next = state.selectedKeywords.includes(kw)
        ? state.selectedKeywords.filter((k) => k !== kw)
        : [...state.selectedKeywords, kw];
      onChange({ selectedKeywords: next });
    },
    [state.selectedKeywords, onChange],
  );

  const handleKeywordsMasterToggle = useCallback(() => {
    if (state.keywordsEnabled) {
      onChange({ keywordsEnabled: false, selectedKeywords: [] });
    } else {
      onChange({ keywordsEnabled: true, selectedKeywords: [...keywords] });
    }
  }, [state.keywordsEnabled, keywords, onChange]);

  // -- Research --
  const allFieldsEnabled = Object.values(state.researchFields).every(Boolean);
  const someFieldsEnabled = Object.values(state.researchFields).some(Boolean);

  const handleResearchMasterToggle = useCallback(() => {
    if (state.researchEnabled) {
      onChange({ researchEnabled: false });
    } else {
      onChange({ researchEnabled: true });
      if (!someFieldsEnabled) {
        RESEARCH_FIELD_KEYS.forEach((f) => onResearchFieldChange(f.key, true));
      }
    }
  }, [state.researchEnabled, someFieldsEnabled, onChange, onResearchFieldChange]);

  // -- Products --
  const handleProductToggle = useCallback(
    (productId: string) => {
      const next = state.selectedProductIds.includes(productId)
        ? state.selectedProductIds.filter((id) => id !== productId)
        : [...state.selectedProductIds, productId];
      onChange({ selectedProductIds: next });
    },
    [state.selectedProductIds, onChange],
  );

  const handleProductsMasterToggle = useCallback(() => {
    if (state.productsEnabled) {
      onChange({ productsEnabled: false, selectedProductIds: [] });
    } else {
      onChange({ productsEnabled: true, selectedProductIds: referenceProducts.map((p) => p.id) });
    }
  }, [state.productsEnabled, referenceProducts, onChange]);

  // -- Reference Images --
  const getRefToggle = useCallback(
    (refId: string): ReferenceToggle | undefined =>
      state.referenceToggles.find((rt) => rt.referenceId === refId),
    [state.referenceToggles],
  );

  const getAnalysisText = useCallback((ref: ProjectReference): string | null => {
    if (!ref.prompt_analysis || typeof ref.prompt_analysis !== 'object') return null;
    const pa = ref.prompt_analysis as Record<string, unknown>;
    return (pa.summary as string) ?? (pa.final_prompt as string) ?? null;
  }, []);

  const getFieldValue = (dataKey: keyof ResearchPreviewData): string | null => {
    if (!researchPreview) return null;
    const val = researchPreview[dataKey];
    if (dataKey === 'vibe' && typeof val === 'object' && val !== null) {
      const v = val as NonNullable<ResearchPreviewData['vibe']>;
      return `${v.energy_level} / ${v.attitude} / ${v.core_emotion}`;
    }
    return val as string | null;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Keywords */}
      <SectionCard disabled={!state.keywordsEnabled}>
        <SectionHeader>
          <Checkbox checked={state.keywordsEnabled} onChange={handleKeywordsMasterToggle} size="small" color="secondary" aria-label={t('design.promptBuilder.context.toggleKeywords', 'Toggle keywords')} />
          <Typography variant="subtitle2">{t('design.promptBuilder.context.keywords', 'Keywords')}</Typography>
        </SectionHeader>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
          {keywords.length === 0 ? (
            <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
              {t('design.promptBuilder.context.noKeywords', 'No keywords -- run Keyword Research first')}
            </Typography>
          ) : (
            keywords.map((kw) => (
              <KeywordChip key={kw} label={kw} size="small" variant="outlined" color={state.selectedKeywords.includes(kw) ? 'secondary' : 'default'} onClick={() => handleKeywordToggle(kw)} aria-pressed={state.selectedKeywords.includes(kw)} />
            ))
          )}
        </Box>
      </SectionCard>

      {/* AI Research */}
      <SectionCard disabled={!state.researchEnabled}>
        <SectionHeader>
          <Checkbox checked={state.researchEnabled && allFieldsEnabled} indeterminate={state.researchEnabled && someFieldsEnabled && !allFieldsEnabled} onChange={handleResearchMasterToggle} size="small" color="secondary" aria-label={t('design.promptBuilder.context.toggleResearch', 'Toggle AI research')} />
          <Typography variant="subtitle2">{t('design.promptBuilder.context.aiResearch', 'AI Research')}</Typography>
        </SectionHeader>
        {isResearchLoading ? (
          <Typography variant="body2" color="text.disabled" sx={{ py: 1, pl: 4 }}>{t('common.loading', 'Loading...')}</Typography>
        ) : !researchPreview ? (
          <Typography variant="body2" color="text.disabled" sx={{ py: 1, pl: 4 }}>{t('design.promptBuilder.context.noResearch', 'No research data available')}</Typography>
        ) : (
          <Box sx={{ mt: 1 }}>
            {RESEARCH_FIELD_KEYS.map(({ key, labelKey, dataKey }) => {
              const value = getFieldValue(dataKey);
              const isChecked = state.researchFields[key];
              return (
                <ResearchRow key={key} sx={{ opacity: isChecked ? 1 : 0.45 }}>
                  <Checkbox checked={isChecked} onChange={() => onResearchFieldChange(key, !isChecked)} size="small" color="secondary" sx={{ p: 0 }} aria-label={t(`design.promptBuilder.context.fields.${labelKey}`, labelKey)} />
                  <ResearchLabel>{t(`design.promptBuilder.context.fields.${labelKey}`, labelKey)}</ResearchLabel>
                  <Typography variant="body2" noWrap>{value ?? '--'}</Typography>
                </ResearchRow>
              );
            })}
          </Box>
        )}
      </SectionCard>

      {/* Reference Products */}
      <SectionCard disabled={!state.productsEnabled}>
        <SectionHeader>
          <Checkbox checked={state.productsEnabled} onChange={handleProductsMasterToggle} size="small" color="secondary" aria-label={t('design.promptBuilder.context.toggleProducts', 'Toggle reference products')} />
          <Typography variant="subtitle2">{t('design.promptBuilder.context.referenceProducts', 'Reference Products')}</Typography>
        </SectionHeader>
        {referenceProducts.length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ py: 1, pl: 4 }}>{t('design.promptBuilder.context.noProducts', 'No reference products available')}</Typography>
        ) : (
          <Grid container spacing={1} sx={{ mt: 0.5 }}>
            {referenceProducts.map((product) => (
              <Grid key={product.id} size={{ xs: 3 }}>
                <ProductThumb src={product.thumbnail_url} alt={product.title} selected={state.selectedProductIds.includes(product.id)} onClick={() => handleProductToggle(product.id)} loading="lazy" />
              </Grid>
            ))}
          </Grid>
        )}
      </SectionCard>
      {/* Reference Images */}
      <SectionCard disabled={references.length === 0}>
        <SectionHeader>
          <Typography variant="subtitle2">
            {t('design.promptBuilder.context.referenceImages', 'Reference Images')}
          </Typography>
        </SectionHeader>
        {references.length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ py: 1, pl: 4 }}>
            {t('design.promptBuilder.context.noReferences', 'No reference images -- add from Niche Pipeline')}
          </Typography>
        ) : (
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {references.map((ref) => {
              const toggle = getRefToggle(ref.id);
              const isEnabled = toggle?.enabled ?? false;
              const mode = toggle?.mode ?? 'image';
              const analysisText = getAnalysisText(ref);
              const showTextPreview = isEnabled && mode === 'text' && analysisText;

              return (
                <Box key={ref.id}>
                  <ReferenceRow sx={{ opacity: isEnabled ? 1 : 0.5 }}>
                    <Checkbox
                      checked={isEnabled}
                      onChange={() => onReferenceToggle(ref.id, !isEnabled)}
                      size="small"
                      color="secondary"
                      sx={{ p: 0 }}
                      aria-label={t('design.promptBuilder.context.toggleReference', 'Toggle reference {{title}}', { title: ref.title })}
                    />
                    <ReferenceThumb src={ref.image_url} alt={ref.title || ''} loading="lazy" />
                    <Tooltip title={ref.title} placement="top">
                      <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                        {ref.title || ref.asin || t('design.promptBuilder.context.untitledRef', 'Untitled')}
                      </Typography>
                    </Tooltip>
                    <ToggleButtonGroup
                      value={mode}
                      exclusive
                      size="small"
                      onChange={(_, val) => {
                        if (val) onReferenceModeChange(ref.id, val as ReferenceMode);
                      }}
                      aria-label={t('design.promptBuilder.context.refModeLabel', 'Reference mode')}
                    >
                      <ToggleButton
                        value="image"
                        disabled={!isMultimodalModel}
                        sx={{ px: 1, py: 0.25 }}
                        aria-label={t('design.promptBuilder.context.modeImage', 'Image (multimodal)')}
                      >
                        <ImageIcon sx={{ fontSize: 16 }} />
                      </ToggleButton>
                      <ToggleButton
                        value="text"
                        disabled={!analysisText}
                        sx={{ px: 1, py: 0.25 }}
                        aria-label={t('design.promptBuilder.context.modeText', 'Text Analysis')}
                      >
                        <TextSnippetIcon sx={{ fontSize: 16 }} />
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </ReferenceRow>
                  <Collapse in={!!showTextPreview}>
                    <AnalysisPreview variant="caption" color="text.secondary">
                      {analysisText}
                    </AnalysisPreview>
                  </Collapse>
                </Box>
              );
            })}
          </Box>
        )}
      </SectionCard>
    </Box>
  );
};

export default ContextTab;
