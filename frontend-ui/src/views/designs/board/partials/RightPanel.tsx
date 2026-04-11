import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { ArtboardData, BackgroundColor, CanvasElement, DesignModel } from '../types';
import type { RightPanelState } from '../hooks/useRightPanelState';
import type { ProjectIdea, ProjectPrompt, ProjectReference } from '../../gallery/types';
import GenerationZone from './GenerationZone';
import type { GenerationMode, AspectRatio } from './GenerationZone';
import PanelArtboardState from './rightPanel/PanelArtboardState';
import PanelMultiState from './rightPanel/PanelMultiState';
import PanelElementState from './rightPanel/PanelElementState';
import AccordionSection from './rightPanel/AccordionSection';
import SloganPoolSection from './rightPanel/SloganPoolSection';
import PromptListSection from './rightPanel/PromptListSection';
import ArtboardListSection from './rightPanel/ArtboardListSection';
import ReferencesSection from './rightPanel/ReferencesSection';
import LayerPanel from './rightPanel/LayerPanel';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

export const RIGHT_PANEL_WIDTH = 383;

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const PanelRoot = styled(Box)(({ theme }) => ({
  width: RIGHT_PANEL_WIDTH,
  height: '100%',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  overflowX: 'hidden',
  borderLeft: '1px solid',
  borderColor: theme.vars.palette.divider,
  backgroundColor: COLORS.ink,
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}`,
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.white,
  }),
}));

const CollapsedGenZone = styled(Box)(({ theme }) => ({
  height: 48,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 2),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: COLORS.inkPaper,
  transition: `all ${DURATION.default}ms ${EASING.standard}`,
  ...theme.applyStyles('light', {
    backgroundColor: theme.vars.palette.background.paper,
  }),
}));

const ScrollableZone = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: theme.spacing(1),
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  padding: theme.spacing(1.5, 1, 0.5),
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface RightPanelProps {
  panelState: RightPanelState;
  onUpdateArtboard: (id: string, patch: Partial<ArtboardData>) => void;
  onResizeArtboard: (id: string, width: number, height: number) => void;
  onOpenInEditor: (ids: string[]) => void;
  onDeleteSelected: (ids: string[]) => void;
  onExportSelected: (ids: string[]) => void;
  onUpdateElement?: (
    artboardId: string,
    elementId: string,
    patch: Partial<Omit<CanvasElement, 'id' | 'type'>>,
  ) => void;
  onSelectElement?: (artboardId: string, elementId: string) => void;
  onReorderElement?: (artboardId: string, elementId: string, newIndex: number) => void;
  onDeleteElement?: (artboardId: string, elementId: string) => void;
  selectedElementId?: string | null;
  // Generation zone props
  prompt?: string;
  onPromptChange?: (prompt: string) => void;
  model?: DesignModel;
  onModelChange?: (model: DesignModel) => void;
  bgColor?: BackgroundColor;
  onBgColorChange?: (color: BackgroundColor) => void;
  imageCount?: number;
  onImageCountChange?: (count: number) => void;
  onGenerate?: () => void;
  isGenerating?: boolean;
  isParallel?: boolean;
  onParallelToggle?: (checked: boolean) => void;
  onOpenPromptBuilder?: () => void;
  onAnalyzeImage?: () => void;
  isAnalyzingImage?: boolean;
  hasSelectedImage?: boolean;
  onGenerateAll?: () => void;
  parallelLineCount?: number;
  // Mode + Resolution
  generationMode?: GenerationMode;
  onGenerationModeChange?: (mode: GenerationMode) => void;
  aspectRatio?: AspectRatio;
  onAspectRatioChange?: (ratio: AspectRatio) => void;
  // Phase G props
  projectId?: string;
  ideas?: ProjectIdea[];
  prompts?: ProjectPrompt[];
  artboards?: ArtboardData[];
  selectedIds?: Set<string>;
  selectedArtboardId?: string;
  onInsertSlogan?: (sloganText: string) => void;
  onSelectArtboard?: (id: string) => void;
  onPromptClick?: (prompt: ProjectPrompt) => void;
  onCreateSkeletonArtboards?: (
    items: Array<{ runId: string; label: string }>,
  ) => void;
  // Phase I: References
  references?: ProjectReference[];
  onUseAsReference?: (imageUrl: string) => void;
  onUseAsPrompt?: (analysisText: string) => void;
  // Phase I7: Source image for generation
  sourceImageUrl?: string | null;
  onClearSourceImage?: () => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const RightPanel = ({
  panelState,
  onUpdateArtboard,
  onResizeArtboard,
  onOpenInEditor,
  onDeleteSelected,
  onExportSelected,
  onUpdateElement,
  onSelectElement,
  onReorderElement,
  onDeleteElement,
  selectedElementId,
  // Generation zone
  prompt = '',
  onPromptChange,
  model = 'google/gemini-3.1-flash-preview-image-generation',
  onModelChange,
  bgColor = 'light_gray',
  onBgColorChange,
  imageCount = 1,
  onImageCountChange,
  onGenerate,
  isGenerating = false,
  isParallel = false,
  onParallelToggle,
  onOpenPromptBuilder,
  onAnalyzeImage,
  isAnalyzingImage = false,
  hasSelectedImage = false,
  onGenerateAll,
  parallelLineCount = 0,
  // Mode + Resolution
  generationMode = 'text_to_image',
  onGenerationModeChange,
  aspectRatio = '1:1',
  onAspectRatioChange,
  // Phase G props
  projectId,
  ideas,
  prompts,
  artboards = [],
  selectedIds,
  onInsertSlogan,
  onSelectArtboard,
  onPromptClick,
  onCreateSkeletonArtboards,
  // Phase I: References
  references,
  onUseAsReference,
  onUseAsPrompt,
  // Phase I7: Source image for generation
  sourceImageUrl,
  onClearSourceImage,
}: RightPanelProps) => {
  const { t } = useTranslation();

  const isElementMode = panelState.mode === 'element';
  const hasGenZone = onPromptChange && onModelChange && onBgColorChange && onGenerate;

  // Determine if layers accordion should show (element or single artboard selected)
  const showLayers =
    (panelState.mode === 'single' || panelState.mode === 'ai' || isElementMode) &&
    panelState.artboard;

  return (
    <PanelRoot
      aria-label={t('design.panel.ariaLabel', 'Properties panel')}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Generation Zone — sticky at top, collapses when element selected */}
      {hasGenZone && (
        isElementMode ? (
          <CollapsedGenZone>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ opacity: 0.7 }}
            >
              {t('design.generation.collapsed', 'Generation')}
            </Typography>
          </CollapsedGenZone>
        ) : (
          <GenerationZone
            prompt={prompt}
            onPromptChange={onPromptChange}
            model={model}
            onModelChange={onModelChange}
            bgColor={bgColor}
            onBgColorChange={onBgColorChange}
            imageCount={imageCount}
            onImageCountChange={onImageCountChange ?? (() => {})}
            onGenerate={onGenerate}
            isGenerating={isGenerating}
            isParallel={isParallel}
            onParallelToggle={onParallelToggle ?? (() => {})}
            onOpenPromptBuilder={onOpenPromptBuilder}
            onAnalyzeImage={onAnalyzeImage}
            isAnalyzingImage={isAnalyzingImage}
            hasSelectedImage={hasSelectedImage}
            onGenerateAll={onGenerateAll}
            parallelLineCount={parallelLineCount}
            mode={generationMode}
            onModeChange={onGenerationModeChange}
            aspectRatio={aspectRatio}
            onAspectRatioChange={onAspectRatioChange}
            sourceImageUrl={sourceImageUrl}
            onClearSourceImage={onClearSourceImage}
          />
        )
      )}

      {/* Element properties — shown between generation zone and scrollable area */}
      {isElementMode &&
        panelState.selectedElement &&
        panelState.selectedElementArtboardId &&
        onUpdateElement && (
          <PanelElementState
            element={panelState.selectedElement}
            artboardId={panelState.selectedElementArtboardId}
            onUpdate={onUpdateElement}
            onDeleteElement={onDeleteElement}
          />
        )}

      {/* Multi-select panel */}
      {panelState.mode === 'multi' && (
        <PanelMultiState
          selectedArtboards={panelState.selectedArtboards}
          onOpenInEditor={onOpenInEditor}
          onDeleteAll={onDeleteSelected}
          onExportSelected={onExportSelected}
        />
      )}

      {/* Single artboard or AI board properties */}
      {(panelState.mode === 'single' || panelState.mode === 'ai') &&
        panelState.artboard && (
          <PanelArtboardState
            artboard={panelState.artboard}
            onUpdate={onUpdateArtboard}
            onResize={onResizeArtboard}
            selectedElementId={selectedElementId}
            onSelectElement={onSelectElement}
            onUpdateElement={onUpdateElement}
            onReorderElement={onReorderElement}
          />
        )}

      {/* Scrollable accordion zone */}
      {(panelState.mode === 'none' || isElementMode) && (
        <ScrollableZone>
          {/* Saved Prompts */}
          {projectId && prompts && (
            <AccordionSection
              title={t('design.prompts.title', 'Saved Prompts')}
              count={prompts.length}
              defaultExpanded
            >
              <PromptListSection
                projectId={projectId}
                prompts={prompts}
                onPromptClick={onPromptClick}
                onCreateSkeletonArtboards={onCreateSkeletonArtboards}
              />
            </AccordionSection>
          )}

          {/* Slogan Pool */}
          {projectId && ideas && (
            <AccordionSection
              title={t('design.sloganPool.title', 'Slogan Pool')}
              count={ideas.length}
              defaultExpanded
            >
              <SloganPoolSection
                projectId={projectId}
                ideas={ideas}
                onInsertSlogan={onInsertSlogan}
              />
            </AccordionSection>
          )}

          {/* References */}
          {projectId && references && onUseAsReference && onUseAsPrompt && (
            <AccordionSection
              title={t('design.references.title', 'References')}
              count={references.length}
            >
              <ReferencesSection
                projectId={projectId}
                references={references}
                onUseAsReference={onUseAsReference}
                onUseAsPrompt={onUseAsPrompt}
              />
            </AccordionSection>
          )}

          {/* Artboards */}
          <AccordionSection
            title={t('design.artboards.title', 'Artboards')}
            count={artboards.length}
            defaultExpanded
          >
            <ArtboardListSection
              artboards={artboards}
              selectedIds={selectedIds ?? new Set()}
              onSelectArtboard={onSelectArtboard ?? (() => {})}
            />
          </AccordionSection>

          {/* Layers (conditional — only when element selected or artboard selected) */}
          {showLayers && panelState.artboard && onSelectElement && onUpdateElement && onReorderElement && (
            <AccordionSection
              title={t('design.canvas.layers.title', 'Layers')}
              count={panelState.artboard.layers.length}
              defaultExpanded={isElementMode}
            >
              <LayerPanel
                artboardId={panelState.artboard.id}
                layers={panelState.artboard.layers}
                selectedElementId={selectedElementId ?? null}
                onSelectElement={onSelectElement}
                onUpdateElement={onUpdateElement}
                onReorderElement={onReorderElement}
              />
            </AccordionSection>
          )}

          {/* None mode label if no project */}
          {!projectId && panelState.mode === 'none' && (
            <SectionLabel variant="caption" color="text.disabled">
              {t('design.panel.noProject', 'No project selected')}
            </SectionLabel>
          )}
        </ScrollableZone>
      )}
    </PanelRoot>
  );
};

export default RightPanel;
