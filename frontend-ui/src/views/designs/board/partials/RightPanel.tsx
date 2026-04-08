import { Box, Divider, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { ArtboardData, BackgroundColor, CanvasElement, DesignModel } from '../types';
import type { RightPanelState } from '../hooks/useRightPanelState';
import type { ProjectIdea, ProjectPrompt } from '../../gallery/types';
import PanelNoneState from './rightPanel/PanelNoneState';
import PanelArtboardState from './rightPanel/PanelArtboardState';
import PanelMultiState from './rightPanel/PanelMultiState';
import PanelElementState from './rightPanel/PanelElementState';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

export const RIGHT_PANEL_WIDTH = 280;

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const PanelRoot = styled(Box)(({ theme }) => ({
  width: RIGHT_PANEL_WIDTH,
  height: '100%',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  overflowX: 'hidden',
  borderLeft: '1px solid',
  borderColor: theme.vars.palette.divider,
  backgroundColor: COLORS.ink,
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}`,
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.white,
  }),
}));

const PanelHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  paddingBottom: theme.spacing(1.5),
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
  // Phase G props
  projectId?: string;
  ideas?: ProjectIdea[];
  prompts?: ProjectPrompt[];
  artboards?: ArtboardData[];
  selectedIds?: Set<string>;
  model?: DesignModel;
  bgColor?: BackgroundColor;
  onAutoPromptFill?: (prompt: string) => void;
  onAddReferenceArtboard?: (imageUrl: string) => void;
  onSelectArtboard?: (id: string) => void;
  onPromptClick?: (prompt: ProjectPrompt) => void;
  onCreateSkeletonArtboards?: (
    items: Array<{ runId: string; label: string }>,
  ) => void;
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
  // Phase G props
  projectId,
  ideas,
  prompts,
  artboards,
  selectedIds,
  model,
  bgColor,
  onAutoPromptFill,
  onAddReferenceArtboard,
  onSelectArtboard,
  onPromptClick,
  onCreateSkeletonArtboards,
}: RightPanelProps) => {
  const { t } = useTranslation();

  const headerTitle = (() => {
    switch (panelState.mode) {
      case 'element':
        return t('design.panel.elementProperties', 'Element');
      case 'single':
        return t('design.panel.artboardProperties', 'Artboard');
      case 'ai':
        return t('design.panel.aiImageBoard', 'AI Image Board');
      case 'multi':
        return t('design.panel.multiSelect', '{{count}} Selected', {
          count: panelState.count,
        });
      default:
        return t('design.panel.project', 'Project');
    }
  })();

  return (
    <PanelRoot
      aria-label={t('design.panel.ariaLabel', 'Properties panel')}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <PanelHeader>
        <Typography variant="subtitle2" color="text.secondary">
          {headerTitle}
        </Typography>
      </PanelHeader>

      <Divider />

      {/* None state: project overview with slogan pool, prompts, artboards */}
      {panelState.mode === 'none' && (
        <PanelNoneState
          projectId={projectId}
          ideas={ideas}
          prompts={prompts}
          artboards={artboards}
          selectedIds={selectedIds}
          model={model}
          bgColor={bgColor}
          onAutoPromptFill={onAutoPromptFill}
          onAddReferenceArtboard={onAddReferenceArtboard}
          onSelectArtboard={onSelectArtboard}
          onPromptClick={onPromptClick}
          onCreateSkeletonArtboards={onCreateSkeletonArtboards}
        />
      )}

      {/* Single artboard or AI board */}
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

      {/* Multi-select */}
      {panelState.mode === 'multi' && (
        <PanelMultiState
          selectedArtboards={panelState.selectedArtboards}
          onOpenInEditor={onOpenInEditor}
          onDeleteAll={onDeleteSelected}
          onExportSelected={onExportSelected}
        />
      )}

      {/* Element selected */}
      {panelState.mode === 'element' &&
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
    </PanelRoot>
  );
};

export default RightPanel;
