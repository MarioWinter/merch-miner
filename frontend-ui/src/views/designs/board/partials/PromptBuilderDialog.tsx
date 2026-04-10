import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { ProjectIdea, PromptPreset } from '../../gallery/types';
import type { SourceToggles } from '../hooks/usePromptBuilder';
import { usePromptBuilderTabs, TAB_KEYS } from '../hooks/usePromptBuilderTabs';
import type { TabKey } from '../hooks/usePromptBuilderTabs';
import ConceptTab from './promptBuilder/ConceptTab';
import ContextTab from './promptBuilder/ContextTab';
import StyleTab from './promptBuilder/StyleTab';
import FormatTab from './promptBuilder/FormatTab';
import ColorTab from './promptBuilder/ColorTab';
import BackgroundTab from './promptBuilder/BackgroundTab';
import TextTab from './promptBuilder/TextTab';
import OutputTab from './promptBuilder/OutputTab';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const DialogRoot = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    backgroundColor: COLORS.inkPaper,
    borderRadius: 16,
    minHeight: 400,
    maxHeight: '80vh',
    overflow: 'hidden',
    ...theme.applyStyles('light', {
      backgroundColor: theme.vars.palette.background.paper,
    }),
  },
}));

const DialogHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(2.5, 3),
}));

const TabNavigation = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(0.5),
  padding: theme.spacing(0, 3),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
}));

const TabItem = styled('button')<{ active: number }>(({ theme, active }) => ({
  all: 'unset',
  cursor: 'pointer',
  ...theme.typography.subtitle2,
  color: active ? theme.vars.palette.secondary.main : theme.vars.palette.text.secondary,
  padding: theme.spacing(1.5, 2),
  position: 'relative',
  transition: `color ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': { color: theme.vars.palette.text.primary },
  '&:focus-visible': {
    outline: `2px solid ${theme.vars.palette.primary.main}`,
    outlineOffset: -2,
    borderRadius: 4,
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: 0,
    left: theme.spacing(2),
    right: theme.spacing(2),
    height: 2,
    backgroundColor: active ? COLORS.cyan : 'transparent',
    borderRadius: 1,
    transition: `background-color ${DURATION.fast}ms ${EASING.standard}, width ${DURATION.fast}ms ${EASING.standard}`,
  },
}));

const TabContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  minHeight: 220,
  overflowY: 'auto',
  flex: 1,
}));

const TabAnimationWrapper = styled(Box)<{ visible: number }>(({ visible }) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'translateX(0)' : 'translateX(8px)',
  transition: `opacity ${DURATION.fast}ms ${EASING.standard}, transform ${DURATION.fast}ms ${EASING.standard}`,
}));

const DialogFooter = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2, 3),
  borderTop: `1px solid ${theme.vars.palette.divider}`,
}));

const GenerateButton = styled(Button)(() => ({
  backgroundColor: COLORS.cyan,
  color: COLORS.ink,
  fontWeight: 600,
  borderRadius: 8,
  '&:hover': {
    backgroundColor: COLORS.cyanDk,
    boxShadow: `0 0 16px ${alpha(COLORS.cyan, 0.35)}`,
  },
  '&.Mui-disabled': { opacity: 0.5 },
}));

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

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

interface PromptBuilderDialogProps {
  open: boolean;
  onClose: () => void;
  ideas: ProjectIdea[];
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
  nicheKeywords: string[];
  researchPreview: ResearchPreviewData | null;
  isResearchLoading: boolean;
  researchColors?: string[];
  sloganText?: string;
  onAnalyzeImage?: () => void;
  isAnalyzingImage?: boolean;
  imageAnalysisResult?: string | null;
  referenceProducts?: ReferenceProduct[];
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
  isSaving,
  bulkSloganIds,
  nicheKeywords,
  researchPreview,
  isResearchLoading,
  researchColors = [],
  sloganText,
  referenceProducts = [],
  setSelectedSloganId,
  buildAndSave,
}: PromptBuilderDialogProps) => {
  const { t } = useTranslation();

  const tabs = usePromptBuilderTabs(setSelectedSloganId, sloganText);
  const isBulk = bulkSloganIds.length > 1;

  const handleBuild = async () => {
    await buildAndSave();
    onClose();
  };

  const tabLabels: Record<TabKey, string> = {
    concept: t('design.promptBuilder.tabs.concept', 'Concept'),
    context: t('design.promptBuilder.tabs.context', 'Context'),
    style: t('design.promptBuilder.tabs.style', 'Style'),
    format: t('design.promptBuilder.tabs.format', 'Format'),
    color: t('design.promptBuilder.tabs.color', 'Color'),
    background: t('design.promptBuilder.tabs.background', 'Background'),
    text: t('design.promptBuilder.tabs.text', 'Text'),
    output: t('design.promptBuilder.tabs.output', 'Output'),
  };

  const renderTabContent = () => {
    switch (tabs.activeTab) {
      case 'concept':
        return <ConceptTab state={tabs.conceptState} ideas={ideas} onChange={tabs.handleConceptChange} />;
      case 'context':
        return (
          <ContextTab
            state={tabs.contextState}
            keywords={nicheKeywords}
            researchPreview={researchPreview}
            isResearchLoading={isResearchLoading}
            referenceProducts={referenceProducts}
            onChange={tabs.handleContextChange}
            onResearchFieldChange={tabs.handleResearchFieldChange}
          />
        );
      case 'style':
        return (
          <StyleTab
            state={tabs.styleState}
            onChange={tabs.handleStyleChange}
            onAddStyle={tabs.handleAddStyle}
            onRemoveStyle={tabs.handleRemoveStyle}
          />
        );
      case 'format':
        return <FormatTab state={tabs.formatState} onChange={tabs.handleFormatChange} />;
      case 'color':
        return (
          <ColorTab
            state={tabs.colorState}
            researchColors={researchColors}
            onChange={tabs.handleColorChange}
          />
        );
      case 'background':
        return (
          <BackgroundTab
            state={tabs.backgroundState}
            onChange={tabs.handleBackgroundChange}
          />
        );
      case 'text':
        return (
          <TextTab
            state={tabs.textState}
            sloganText={sloganText}
            onChange={tabs.handleTextChange}
          />
        );
      case 'output':
        return (
          <OutputTab
            state={tabs.outputState}
            onChange={tabs.handleOutputChange}
          />
        );
      default:
        return null;
    }
  };

  return (
    <DialogRoot open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="prompt-builder-title">
      {/* Header */}
      <DialogHeader>
        <AutoAwesomeIcon sx={{ fontSize: 20, color: 'secondary.main', mr: 1 }} />
        <Typography id="prompt-builder-title" variant="h4" sx={{ flex: 1 }}>
          {isBulk
            ? t('design.promptBuilder.titleBulk', 'Building prompts for {{count}} slogans', { count: bulkSloganIds.length })
            : t('design.promptBuilder.title', 'Prompt Builder')}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label={t('common.close', 'Close')} sx={{ width: 32, height: 32 }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogHeader>

      {/* Tab Navigation */}
      <TabNavigation role="tablist" aria-label={t('design.promptBuilder.tabs.label', 'Prompt builder tabs')}>
        {TAB_KEYS.map((tab) => (
          <TabItem
            key={tab}
            role="tab"
            aria-selected={tabs.activeTab === tab}
            aria-controls={`pb-tabpanel-${tab}`}
            id={`pb-tab-${tab}`}
            active={tabs.activeTab === tab ? 1 : 0}
            onClick={() => tabs.setActiveTab(tab)}
          >
            {tabLabels[tab]}
          </TabItem>
        ))}
      </TabNavigation>

      {/* Tab Content */}
      <TabContent role="tabpanel" id={`pb-tabpanel-${tabs.activeTab}`} aria-labelledby={`pb-tab-${tabs.activeTab}`}>
        <TabAnimationWrapper key={tabs.activeTab} visible={1}>
          {renderTabContent()}
        </TabAnimationWrapper>
      </TabContent>

      {/* Footer */}
      <DialogFooter>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <GenerateButton
          startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: 18 }} />}
          onClick={() => void handleBuild()}
          disabled={isSaving}
        >
          {t('design.promptBuilder.generatePrompt', 'Generate Prompt')}
        </GenerateButton>
      </DialogFooter>
    </DialogRoot>
  );
};

export default PromptBuilderDialog;
