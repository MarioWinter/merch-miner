import { Box, Divider, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { ArtboardData } from '../types';
import type { RightPanelState } from '../hooks/useRightPanelState';
import PanelNoneState from './rightPanel/PanelNoneState';
import PanelArtboardState from './rightPanel/PanelArtboardState';
import PanelMultiState from './rightPanel/PanelMultiState';

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
  backgroundColor: COLORS.inkPaper,
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
  onRegenerate: () => void;
  onOpenInEditor: (ids: string[]) => void;
  onDeleteSelected: (ids: string[]) => void;
  onExportSelected: (ids: string[]) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const RightPanel = ({
  panelState,
  onUpdateArtboard,
  onResizeArtboard,
  onRegenerate,
  onOpenInEditor,
  onDeleteSelected,
  onExportSelected,
}: RightPanelProps) => {
  const { t } = useTranslation();

  const headerTitle = (() => {
    switch (panelState.mode) {
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
    <PanelRoot aria-label={t('design.panel.ariaLabel', 'Properties panel')}>
      <PanelHeader>
        <Typography variant="subtitle2" color="text.secondary">
          {headerTitle}
        </Typography>
      </PanelHeader>

      <Divider />

      {/* None state: project overview */}
      {panelState.mode === 'none' && <PanelNoneState />}

      {/* Single artboard or AI board */}
      {(panelState.mode === 'single' || panelState.mode === 'ai') &&
        panelState.artboard && (
          <PanelArtboardState
            artboard={panelState.artboard}
            isAiBoard={panelState.mode === 'ai'}
            onUpdate={onUpdateArtboard}
            onResize={onResizeArtboard}
            onRegenerate={onRegenerate}
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
    </PanelRoot>
  );
};

export default RightPanel;
