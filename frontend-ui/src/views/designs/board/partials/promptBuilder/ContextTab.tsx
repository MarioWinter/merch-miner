import { useCallback } from 'react';
import { Box, Checkbox, Grid, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  SectionCard,
  SectionHeader,
  KeywordChip,
  ResearchRow,
  ResearchLabel,
  ProductThumb,
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

export interface ContextTabState {
  keywordsEnabled: boolean;
  selectedKeywords: string[];
  researchEnabled: boolean;
  researchFields: ResearchFields;
  productsEnabled: boolean;
  selectedProductIds: string[];
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
  onChange: (patch: Partial<ContextTabState>) => void;
  onResearchFieldChange: (field: keyof ResearchFields, value: boolean) => void;
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
  onChange,
  onResearchFieldChange,
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
    </Box>
  );
};

export default ContextTab;
