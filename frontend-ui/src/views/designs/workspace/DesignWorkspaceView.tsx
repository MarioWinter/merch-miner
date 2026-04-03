import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArtboardData, BackgroundColor, DesignModel } from '../board/types';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, IconButton, Skeleton, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useGetProjectQuery, useGetProjectBoardQuery, useBatchProcessMutation, useDeleteDesignMutation } from '@/store/designSlice';
import ConfirmDialog from '@/components/ConfirmDialog';
import useArtboardCanvas from '../board/hooks/useArtboardCanvas';
import useArtboards from '../board/hooks/useArtboards';
import useCanvasHistory from '../board/hooks/useCanvasHistory';
import useRightPanelState from '../board/hooks/useRightPanelState';
import usePromptBar from '../board/hooks/usePromptBar';
import { useGeneration } from '../board/hooks/useGeneration';
import ArtboardCanvas from '../board/partials/ArtboardCanvas';
import BottomToolbar from '../board/partials/BottomToolbar';
import { PromptBar } from '../board/partials/PromptBar';
import type { CanvasTool } from '../board/partials/BottomToolbar';
import RightPanel from '../board/partials/RightPanel';
import NicheBindingSelector from '../board/partials/NicheBindingSelector';
import ExportDialog from '../board/partials/ExportDialog';
import DesignEditorView from '../editor/DesignEditorView';
import ProcessingSettingsDialog from './ProcessingSettingsDialog';
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
  const { enqueueSnackbar } = useSnackbar();

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

  // -- Canvas history (undo/redo) --
  const canvasHistory = useCanvasHistory();

  /** Push current state onto history before a mutation */
  const pushHistory = useCallback(() => {
    canvasHistory.pushSnapshot(artboardState.artboards, artboardState.edges);
  }, [canvasHistory, artboardState.artboards, artboardState.edges]);

  const handleCanvasUndo = useCallback(() => {
    const snapshot = canvasHistory.undo(artboardState.artboards, artboardState.edges);
    if (snapshot) {
      artboardState.replaceAll(snapshot.artboards, snapshot.edges);
    }
  }, [canvasHistory, artboardState]);

  const handleCanvasRedo = useCallback(() => {
    const snapshot = canvasHistory.redo(artboardState.artboards, artboardState.edges);
    if (snapshot) {
      artboardState.replaceAll(snapshot.artboards, snapshot.edges);
    }
  }, [canvasHistory, artboardState]);

  // Keyboard shortcuts: Cmd+Z / Cmd+Shift+Z (only on canvas tab)
  useEffect(() => {
    if (activeTab !== 'canvas') return;
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta || e.key.toLowerCase() !== 'z') return;

      e.preventDefault();
      if (e.shiftKey) {
        handleCanvasRedo();
      } else {
        handleCanvasUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, handleCanvasUndo, handleCanvasRedo]);

  const panelState = useRightPanelState({
    artboards: artboardState.artboards,
    selectedIds: artboardState.selectedIds,
  });

  // -- Prompt bar state --
  const promptBar = usePromptBar(panelState.mode);
  const [prompt, setPrompt] = useState('');
  const [aiModel, setAiModel] = useState<DesignModel>('gemini_flash');
  const [bgColor, setBgColor] = useState<BackgroundColor>('light_gray');

  // -- AI generation --
  const generation = useGeneration(projectId ?? '');
  const generatingArtboardRef = useRef<string | null>(null);

  // -- Sync prompt state when selecting an AI artboard --
  const selectedAb = panelState.artboard;
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = selectedAb?.id ?? null;
    if (id === prevSelectedIdRef.current) return;
    prevSelectedIdRef.current = id;

    if (selectedAb?.kind === 'ai' && selectedAb.promptUsed) {
      setPrompt(selectedAb.promptUsed);
      if (selectedAb.modelUsed) setAiModel(selectedAb.modelUsed);
      if (selectedAb.bgColorUsed) setBgColor(selectedAb.bgColorUsed);
    }
  }, [selectedAb]);

  const isRegenerate = !!(selectedAb?.kind === 'ai' && selectedAb.imageUrl);

  // -- Update skeleton artboard when generation completes --
  const prevDesignCountRef = useRef(boardData?.designs?.length ?? 0);
  useEffect(() => {
    const designs = boardData?.designs;
    if (!designs || !generatingArtboardRef.current) return;

    const prevCount = prevDesignCountRef.current;
    prevDesignCountRef.current = designs.length;

    // When a new design appears while we have a generating artboard
    if (designs.length > prevCount && !generation.isGenerating) {
      const newest = designs[0]; // ordered by created_at desc
      if (newest?.image_file) {
        artboardState.updateArtboard(generatingArtboardRef.current, {
          imageUrl: newest.image_file,
          designId: newest.id,
          isGenerating: false,
        });
        generatingArtboardRef.current = null;
      }
    }
  }, [boardData?.designs, generation.isGenerating, artboardState]);

  // -- Right panel handlers --
  const handleRegenerate = useCallback(() => {
    // TODO: trigger AI design generation for the selected AI Image Board
  }, []);

  const [batchProcess] = useBatchProcessMutation();
  const handleBgRemove = useCallback(async () => {
    const artboard = panelState.artboard;
    if (!artboard?.designId) return;
    try {
      await batchProcess({ design_ids: [artboard.designId], steps: ['bg_remove'] }).unwrap();
    } catch {
      // error handled by RTK
    }
  }, [panelState.artboard, batchProcess]);

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

  // -- Delete with server-side removal for persisted designs --
  const [deleteDesign] = useDeleteDesignMutation();
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDeletingFromServer, setIsDeletingFromServer] = useState(false);

  const handleDeleteSelected = useCallback(
    (ids: string[]) => {
      pushHistory();
      // Check if any artboards have server-persisted designs
      const hasServerDesigns = artboardState.artboards
        .filter((ab) => ids.includes(ab.id))
        .some((ab) => ab.designId);

      if (hasServerDesigns) {
        setPendingDeleteIds(ids);
        setDeleteConfirmOpen(true);
      } else {
        // Local-only artboards: remove without confirmation
        artboardState.removeArtboards(ids);
      }
    },
    [artboardState, pushHistory],
  );

  const handleDeleteConfirm = useCallback(async () => {
    setIsDeletingFromServer(true);
    const toDelete = artboardState.artboards.filter(
      (ab) => pendingDeleteIds.includes(ab.id) && ab.designId,
    );

    try {
      await Promise.all(
        toDelete.map((ab) =>
          deleteDesign({ designId: ab.designId!, projectId }).unwrap(),
        ),
      );
      artboardState.removeArtboards(pendingDeleteIds);
      enqueueSnackbar(t('design.canvas.deleteSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('design.canvas.deleteError'), { variant: 'error' });
    } finally {
      setIsDeletingFromServer(false);
      setDeleteConfirmOpen(false);
      setPendingDeleteIds([]);
    }
  }, [pendingDeleteIds, artboardState, deleteDesign, projectId, enqueueSnackbar, t]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmOpen(false);
    setPendingDeleteIds([]);
  }, []);

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

  // -- History-aware wrappers for artboard mutations --
  const moveArtboardWithHistory = useCallback(
    (id: string, x: number, y: number) => {
      pushHistory();
      artboardState.moveArtboard(id, x, y);
    },
    [pushHistory, artboardState],
  );

  const resizeArtboardWithHistory = useCallback(
    (id: string, width: number, height: number) => {
      pushHistory();
      artboardState.resizeArtboard(id, width, height);
    },
    [pushHistory, artboardState],
  );

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generation.isGenerating) return;

    pushHistory();

    // Create a skeleton artboard on the canvas
    const skeletonAb = artboardState.addArtboard({
      label: `AI: ${prompt.slice(0, 30)}${prompt.length > 30 ? '…' : ''}`,
      kind: 'ai',
      width: 280,
      height: 280,
      isGenerating: true,
      promptUsed: prompt,
      modelUsed: aiModel,
      bgColorUsed: bgColor,
    });
    generatingArtboardRef.current = skeletonAb.id;

    try {
      await generation.trigger({
        model: aiModel,
        background_color: bgColor,
        prompt,
      });
      promptBar.collapse();
    } catch {
      artboardState.updateArtboard(skeletonAb.id, { isGenerating: false });
    }
  }, [prompt, generation, artboardState, aiModel, bgColor, promptBar, pushHistory]);

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
          <IconButton size="small" aria-label={t('design.workspace.settings')} onClick={() => setSettingsOpen(true)}>
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
                moveArtboard={moveArtboardWithHistory}
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
                resizeArtboard={resizeArtboardWithHistory}
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
                isGenerating={generation.isGenerating}
                isRegenerate={isRegenerate}
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
                onUndo={handleCanvasUndo}
                onRedo={handleCanvasRedo}
                canUndo={canvasHistory.canUndo}
                canRedo={canvasHistory.canRedo}
              />
            </CanvasColumn>
            <RightPanel
              panelState={panelState}
              onUpdateArtboard={artboardState.updateArtboard}
              onResizeArtboard={artboardState.resizeArtboard}
              onRegenerate={handleRegenerate}
              onBgRemove={handleBgRemove}
              onOpenInEditor={handleOpenInEditor}
              onDeleteSelected={handleDeleteSelected}
              onExportSelected={handleExportSelected}
            />
          </>
        ) : (
          <DesignEditorView projectId={projectId ?? ''} initialImages={editorInitialImages} />
        )}
      </ContentArea>
      {/* Export dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        artboards={exportArtboardsRef.current}
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        title={t('design.canvas.deleteDialogTitle', 'Delete Designs')}
        body={t('design.canvas.deleteDialogBody', {
          count: pendingDeleteIds.length,
        })}
        confirmLabel={t('design.canvas.deleteConfirm', 'Delete')}
        cancelLabel={t('design.canvas.deleteCancel', 'Cancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isLoading={isDeletingFromServer}
      />
      <ProcessingSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </WorkspaceRoot>
  );
};

export default DesignWorkspaceView;
