import { useCallback, useMemo, useRef, useState } from 'react';
import type { ArtboardData, BackgroundColor, DesignModel } from '../board/types';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, IconButton, Skeleton, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import { useTranslation } from 'react-i18next';
import { useGetProjectQuery, useGetProjectBoardQuery } from '@/store/designSlice';
import useArtboardCanvas from '../board/hooks/useArtboardCanvas';
import useArtboards from '../board/hooks/useArtboards';
import useRightPanelState from '../board/hooks/useRightPanelState';
import usePromptBar from '../board/hooks/usePromptBar';
import ArtboardCanvas from '../board/partials/ArtboardCanvas';
import BottomToolbar from '../board/partials/BottomToolbar';
import { PromptBar } from '../board/partials/PromptBar';
import type { CanvasTool } from '../board/partials/BottomToolbar';
import RightPanel from '../board/partials/RightPanel';
import NicheBindingSelector from '../board/partials/NicheBindingSelector';
import ExportDialog from '../board/partials/ExportDialog';
import DesignEditorView from '../editor/DesignEditorView';
import useWorkspaceTab from './hooks/useWorkspaceTab';
import type { WorkspaceTab } from './hooks/useWorkspaceTab';
import {
  WorkspaceRoot,
  HeaderBar,
  TabButton,
  TabGroup,
  ContentArea,
  CanvasColumn,
} from './DesignWorkspaceView.styles';

// -----------------------------------------------------------------
// TabToggle (small helper)
// -----------------------------------------------------------------

interface TabToggleProps {
  tab: WorkspaceTab;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: (tab: WorkspaceTab) => void;
}

const TabToggle = ({ tab, icon, label, active, onClick }: TabToggleProps) => (
  <TabButton
    $active={active}
    onClick={() => onClick(tab)}
    aria-pressed={active}
    role="tab"
  >
    {icon}
    {label}
  </TabButton>
);

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const DesignWorkspaceView = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeTab, setActiveTab } = useWorkspaceTab();

  const {
    data: project,
    isLoading,
    isError,
  } = useGetProjectQuery(projectId ?? '', { skip: !projectId });

  const { data: boardData } = useGetProjectBoardQuery(
    { projectId: projectId ?? '' },
    { skip: !projectId },
  );

  // -- Lifted canvas state (shared between canvas + bottom toolbar) --
  const canvasHook = useArtboardCanvas();

  // -- Active canvas tool --
  const [activeTool, setActiveTool] = useState<CanvasTool>('cursor');

  // -- Lifted artboard state (shared between canvas + right panel) --
  const artboardState = useArtboards({
    projectId: projectId ?? '',
    savedLayout: boardData?.board_layout ?? null,
    designs: boardData?.designs,
  });

  const panelState = useRightPanelState({
    artboards: artboardState.artboards,
    selectedIds: artboardState.selectedIds,
  });

  // -- Prompt bar state --
  const promptBar = usePromptBar(panelState.mode);
  const [prompt, setPrompt] = useState('');
  const [aiModel, setAiModel] = useState<DesignModel>('gemini_flash');
  const [bgColor, setBgColor] = useState<BackgroundColor>('light_gray');

  // -- Right panel handlers --
  const handleRegenerate = useCallback(() => {
    // TODO: trigger AI design generation for the selected AI Image Board
  }, []);

  // Images from canvas artboards to pass directly to editor (blob URLs without designId)
  const [editorInitialImages, setEditorInitialImages] = useState<
    Array<{ url: string; name: string }>
  >([]);

  const handleOpenInEditor = useCallback(
    (artboardIds: string[]) => {
      const selected = artboardState.artboards.filter((ab) =>
        artboardIds.includes(ab.id),
      );

      // Split: artboards with designId → URL param, artboards with only imageUrl → direct pass
      const designIds = selected
        .filter((ab) => ab.designId)
        .map((ab) => ab.designId as string);

      const localImages = selected
        .filter((ab) => !ab.designId && ab.imageUrl)
        .map((ab) => ({ url: ab.imageUrl as string, name: ab.label }));

      setEditorInitialImages(localImages);
      setActiveTab('editor');

      const params = new URLSearchParams({ tab: 'editor' });
      if (designIds.length > 0) {
        params.set('designs', designIds.join(','));
      }
      navigate(`?${params.toString()}`);
    },
    [artboardState.artboards, navigate, setActiveTab],
  );

  const handleDeleteSelected = useCallback(
    (ids: string[]) => {
      artboardState.removeArtboards(ids);
    },
    [artboardState],
  );

  // -- Export dialog state --
  const exportArtboardsRef = useRef<ArtboardData[]>([]);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const handleExportSelected = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      exportArtboardsRef.current = artboardState.artboards.filter((ab) => idSet.has(ab.id));
      setExportDialogOpen(true);
    },
    [artboardState.artboards],
  );

  // -- Artboard bounding box (for fit-to-view) --
  const artboardBounds = useMemo(() => {
    const abs = artboardState.artboards;
    if (abs.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const ab of abs) {
      minX = Math.min(minX, ab.x);
      minY = Math.min(minY, ab.y);
      maxX = Math.max(maxX, ab.x + ab.width);
      maxY = Math.max(maxY, ab.y + ab.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [artboardState.artboards]);

  const handleFitToView = useCallback(() => {
    canvasHook.fitToView(artboardBounds);
  }, [canvasHook, artboardBounds]);

  const handleAiSparkle = useCallback(() => {
    promptBar.expand();
  }, [promptBar]);

  const handleGenerate = useCallback(() => {
    // TODO: wire to useGeneration hook with prompt, aiModel, bgColor
  }, []);

  // -- Loading --
  if (isLoading) {
    return (
      <WorkspaceRoot>
        <HeaderBar>
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="text" width={200} height={28} />
          <Box sx={{ flex: 1 }} />
          <Skeleton variant="rounded" width={260} height={32} />
        </HeaderBar>
        <ContentArea>
          <Skeleton
            variant="rectangular"
            sx={{ width: '100%', height: '100%' }}
          />
        </ContentArea>
      </WorkspaceRoot>
    );
  }

  // -- Error --
  if (isError || !projectId) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{t('design.workspace.loadError')}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/designs')}
          sx={{ mt: 2 }}
        >
          {t('design.workspace.backToGallery')}
        </Button>
      </Box>
    );
  }

  return (
    <WorkspaceRoot>
      {/* ---- Header ---- */}
      <HeaderBar>
        <Tooltip title={t('design.workspace.backToGallery')}>
          <IconButton
            onClick={() => navigate('/designs')}
            size="small"
            aria-label={t('design.workspace.backToGallery')}
          >
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>
          {project?.name ?? t('design.workspace.untitled')}
        </Typography>

        {project && (
          <NicheBindingSelector
            projectId={projectId}
            currentNicheId={project.niche}
            currentNicheName={project.niche_summary?.name ?? null}
          />
        )}

        <Box sx={{ flex: 1 }} />

        <TabGroup>
          <TabToggle
            tab="canvas"
            icon={<AutoFixHighIcon sx={{ fontSize: 16 }} />}
            label={t('design.workspace.tabCanvas')}
            active={activeTab === 'canvas'}
            onClick={setActiveTab}
          />
          <TabToggle
            tab="editor"
            icon={<BuildOutlinedIcon sx={{ fontSize: 16 }} />}
            label={t('design.workspace.tabEditor')}
            active={activeTab === 'editor'}
            onClick={setActiveTab}
          />
        </TabGroup>

        <Tooltip title={t('design.workspace.settings')}>
          <IconButton size="small" aria-label={t('design.workspace.settings')}>
            <SettingsOutlinedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </HeaderBar>

      {/* ---- Content ---- */}
      <ContentArea>
        {activeTab === 'canvas' ? (
          <>
            <CanvasColumn>
              <ArtboardCanvas
                projectId={projectId ?? ''}
                artboards={artboardState.artboards}
                edges={artboardState.edges}
                selectedIds={artboardState.selectedIds}
                selectArtboard={artboardState.selectArtboard}
                deselectAll={artboardState.deselectAll}
                selectByRect={artboardState.selectByRect}
                moveArtboard={artboardState.moveArtboard}
                renameArtboard={artboardState.renameArtboard}
                addArtboard={artboardState.addArtboard}
                addAiImageBoard={artboardState.addAiImageBoard}
                removeArtboards={artboardState.removeArtboards}
                duplicateArtboard={artboardState.duplicateArtboard}
                bringToFront={artboardState.bringToFront}
                sendToBack={artboardState.sendToBack}
                updateArtboard={artboardState.updateArtboard}
                canvasState={canvasHook.state}
                containerRef={canvasHook.containerRef}
                setContainerRef={canvasHook.setContainerRef}
                handleWheel={canvasHook.handleWheel}
                setPan={canvasHook.setPan}
                resizeArtboard={artboardState.resizeArtboard}
              />
              <PromptBar
                isExpanded={promptBar.isExpanded}
                onExpand={promptBar.expand}
                onCollapse={promptBar.collapse}
                prompt={prompt}
                onPromptChange={setPrompt}
                model={aiModel}
                onModelChange={setAiModel}
                bgColor={bgColor}
                onBgColorChange={setBgColor}
                onGenerate={handleGenerate}
                isGenerating={false}
                sourceArtboard={panelState.artboard}
                resultArtboards={[]}
              />
              <BottomToolbar
                zoom={canvasHook.state.zoom}
                onZoomIn={() => canvasHook.zoomTo(canvasHook.state.zoom * 1.2)}
                onZoomOut={() => canvasHook.zoomTo(canvasHook.state.zoom / 1.2)}
                onFitToView={handleFitToView}
                onZoomTo={canvasHook.zoomTo}
                activeTool={activeTool}
                onToolChange={setActiveTool}
                onAiSparkle={handleAiSparkle}
              />
            </CanvasColumn>
            <RightPanel
              panelState={panelState}
              onUpdateArtboard={artboardState.updateArtboard}
              onResizeArtboard={artboardState.resizeArtboard}
              onRegenerate={handleRegenerate}
              onOpenInEditor={handleOpenInEditor}
              onDeleteSelected={handleDeleteSelected}
              onExportSelected={handleExportSelected}
            />
          </>
        ) : (
          <DesignEditorView initialImages={editorInitialImages} />
        )}
      </ContentArea>
      {/* Export dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        artboards={exportArtboardsRef.current}
      />
    </WorkspaceRoot>
  );
};

export default DesignWorkspaceView;
