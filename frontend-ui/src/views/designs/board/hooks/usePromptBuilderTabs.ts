import { useState, useCallback, useMemo } from 'react';
import type { ConceptTabState } from '../partials/promptBuilder/ConceptTab';
import type { ContextTabState, ResearchFields, ReferenceMode, ReferenceToggle } from '../partials/promptBuilder/ContextTab';
import type { StyleTabState, StyleEntry, StyleCategory } from '../partials/promptBuilder/StyleTab';
import type { FormatTabState } from '../partials/promptBuilder/FormatTab';
import type { ColorTabState } from '../partials/promptBuilder/ColorTab';
import type { BackgroundTabState } from '../partials/promptBuilder/BackgroundTab';
import type { TextTabState } from '../partials/promptBuilder/TextTab';
import type { OutputTabState } from '../partials/promptBuilder/OutputTab';

// -----------------------------------------------------------------
// Tab key type
// -----------------------------------------------------------------

export const TAB_KEYS = [
  'concept',
  'context',
  'style',
  'format',
  'color',
  'background',
  'text',
  'output',
] as const;

export type TabKey = (typeof TAB_KEYS)[number];

// -----------------------------------------------------------------
// Prompt generation helper
// -----------------------------------------------------------------

const buildPromptText = (
  concept: ConceptTabState,
  context: ContextTabState,
  style: StyleTabState,
  format: FormatTabState,
  color: ColorTabState,
  background: BackgroundTabState,
  text: TextTabState,
  output: OutputTabState,
  sloganText?: string,
): string => {
  const parts: string[] = [];

  // Concept
  if (concept.mainSubject) parts.push(concept.mainSubject);
  if (concept.contentType) parts.push(`Style: ${concept.contentType.replace(/_/g, ' ')}`);
  if (concept.mood) parts.push(`Mood: ${concept.mood.replace(/_/g, ' ')}`);

  // Context — keywords
  if (context.keywordsEnabled && context.selectedKeywords.length > 0) {
    parts.push(`Keywords: ${context.selectedKeywords.join(', ')}`);
  }

  // Style
  if (style.addedStyles.length > 0) {
    const styleStr = style.addedStyles.map((s) => s.style.replace(/_/g, ' ')).join(', ');
    parts.push(`Art style: ${styleStr}`);
  }

  // Format
  if (format.orientation) parts.push(`Orientation: ${format.orientation}`);
  if (format.aspectRatio) parts.push(`Aspect ratio: ${format.aspectRatio}`);
  if (format.detailLevel) parts.push(`Detail: ${format.detailLevel.replace(/_/g, ' ')}`);
  if (format.renderingStyle) parts.push(`Rendering: ${format.renderingStyle.replace(/_/g, ' ')}`);
  if (format.composition) parts.push(`Composition: ${format.composition.replace(/_/g, ' ')}`);

  // Color
  if (color.selectedColors.length > 0) {
    parts.push(`Color palette: ${color.selectedColors.join(', ')}`);
  }

  // Background
  if (background.bgType) parts.push(`Background: ${background.bgType}`);
  if (background.selectedPreset) parts.push(`BG preset: ${background.selectedPreset.replace(/_/g, ' ')}`);

  // Text
  if (text.textMode === 'slogan' && sloganText) {
    parts.push(`Include text: "${sloganText}"`);
  } else if (text.textMode === 'custom' && text.customText) {
    parts.push(`Include text: "${text.customText}"`);
  }

  // Output
  if (output.use) parts.push(`Use: ${output.use.replace(/_/g, ' ')}`);
  if (output.avoid) parts.push(`Avoid: ${output.avoid.replace(/_/g, ' ')}`);
  if (output.printRequirements) parts.push(`Print: ${output.printRequirements.replace(/_/g, ' ')}`);
  if (output.finalFeel) parts.push(`Feel: ${output.finalFeel.replace(/_/g, ' ')}`);

  return parts.join('. ').trim();
};

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

export const usePromptBuilderTabs = (
  setSelectedSloganId: (id: string | null) => void,
  sloganText?: string,
) => {
  const [activeTab, setActiveTab] = useState<TabKey>('concept');

  // -- Concept --
  const [conceptState, setConceptState] = useState<ConceptTabState>({
    promptTitle: '',
    selectedSloganId: null,
    mainSubject: '',
    contentType: '',
    mood: '',
  });

  const handleConceptChange = useCallback(
    (patch: Partial<ConceptTabState>) => {
      setConceptState((prev) => {
        const next = { ...prev, ...patch };
        if ('selectedSloganId' in patch) {
          setSelectedSloganId(patch.selectedSloganId ?? null);
        }
        return next;
      });
    },
    [setSelectedSloganId],
  );

  // -- Context --
  const [contextState, setContextState] = useState<ContextTabState>({
    keywordsEnabled: false,
    selectedKeywords: [],
    researchEnabled: false,
    researchFields: {
      visualStyle: true,
      vibe: true,
      tone: true,
      elements: true,
      aesthetics: true,
      layout: true,
    },
    productsEnabled: false,
    selectedProductIds: [],
    referenceToggles: [],
  });

  const handleContextChange = useCallback(
    (patch: Partial<ContextTabState>) => {
      setContextState((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const handleResearchFieldChange = useCallback(
    (field: keyof ResearchFields, value: boolean) => {
      setContextState((prev) => ({
        ...prev,
        researchFields: { ...prev.researchFields, [field]: value },
      }));
    },
    [],
  );

  const handleReferenceToggle = useCallback(
    (referenceId: string, enabled: boolean) => {
      setContextState((prev) => {
        const existing = prev.referenceToggles.find((rt) => rt.referenceId === referenceId);
        if (existing) {
          return {
            ...prev,
            referenceToggles: prev.referenceToggles.map((rt) =>
              rt.referenceId === referenceId ? { ...rt, enabled } : rt,
            ),
          };
        }
        const newToggle: ReferenceToggle = { referenceId, enabled, mode: 'image' };
        return { ...prev, referenceToggles: [...prev.referenceToggles, newToggle] };
      });
    },
    [],
  );

  const handleReferenceModeChange = useCallback(
    (referenceId: string, mode: ReferenceMode) => {
      setContextState((prev) => ({
        ...prev,
        referenceToggles: prev.referenceToggles.map((rt) =>
          rt.referenceId === referenceId ? { ...rt, mode } : rt,
        ),
      }));
    },
    [],
  );

  // -- Style --
  const [styleState, setStyleState] = useState<StyleTabState>({
    selectedCategory: '',
    selectedStyle: '',
    addedStyles: [],
  });

  const handleStyleChange = useCallback(
    (patch: Partial<StyleTabState>) => {
      setStyleState((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const handleAddStyle = useCallback(() => {
    if (!styleState.selectedCategory || !styleState.selectedStyle) return;
    const entry: StyleEntry = {
      category: styleState.selectedCategory as StyleCategory,
      style: styleState.selectedStyle,
    };
    setStyleState((prev) => ({
      ...prev,
      addedStyles: [...prev.addedStyles, entry],
      selectedCategory: '',
      selectedStyle: '',
    }));
  }, [styleState.selectedCategory, styleState.selectedStyle]);

  const handleRemoveStyle = useCallback((index: number) => {
    setStyleState((prev) => ({
      ...prev,
      addedStyles: prev.addedStyles.filter((_, i) => i !== index),
    }));
  }, []);

  // -- Format --
  const [formatState, setFormatState] = useState<FormatTabState>({
    orientation: '',
    aspectRatio: '',
    detailLevel: '',
    renderingStyle: '',
    composition: '',
  });

  const handleFormatChange = useCallback(
    (patch: Partial<FormatTabState>) => {
      setFormatState((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  // -- Color (H7.5) --
  const [colorState, setColorState] = useState<ColorTabState>({
    selectedColors: [],
  });

  const handleColorChange = useCallback(
    (patch: Partial<ColorTabState>) => {
      setColorState((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  // -- Background (H7.5) --
  const [backgroundState, setBackgroundState] = useState<BackgroundTabState>({
    bgType: '',
    selectedPreset: '',
  });

  const handleBackgroundChange = useCallback(
    (patch: Partial<BackgroundTabState>) => {
      setBackgroundState((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  // -- Text (H7.5) --
  const [textState, setTextState] = useState<TextTabState>({
    textMode: '',
    customText: '',
  });

  const handleTextChange = useCallback(
    (patch: Partial<TextTabState>) => {
      setTextState((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  // -- Output (H7.6) --
  const [outputState, setOutputState] = useState<OutputTabState>({
    use: '',
    avoid: '',
    printRequirements: '',
    finalFeel: '',
  });

  const handleOutputChange = useCallback(
    (patch: Partial<OutputTabState>) => {
      setOutputState((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  // -- Prompt generation (H7.7) --
  const generatedPrompt = useMemo(
    () =>
      buildPromptText(
        conceptState,
        contextState,
        styleState,
        formatState,
        colorState,
        backgroundState,
        textState,
        outputState,
        sloganText,
      ),
    [conceptState, contextState, styleState, formatState, colorState, backgroundState, textState, outputState, sloganText],
  );

  return {
    activeTab,
    setActiveTab,
    // Concept
    conceptState,
    handleConceptChange,
    // Context
    contextState,
    handleContextChange,
    handleResearchFieldChange,
    handleReferenceToggle,
    handleReferenceModeChange,
    // Style
    styleState,
    handleStyleChange,
    handleAddStyle,
    handleRemoveStyle,
    // Format
    formatState,
    handleFormatChange,
    // Color
    colorState,
    handleColorChange,
    // Background
    backgroundState,
    handleBackgroundChange,
    // Text
    textState,
    handleTextChange,
    // Output
    outputState,
    handleOutputChange,
    // Generated prompt
    generatedPrompt,
  };
};
