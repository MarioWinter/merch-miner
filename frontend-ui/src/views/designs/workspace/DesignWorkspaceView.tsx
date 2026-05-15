import { useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Badge, Box, Button, Drawer, Fab, IconButton, InputBase, Skeleton, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useGetProjectQuery, useGetProjectBoardQuery, useUpdateProjectMutation } from '@/store/designSlice';
import { useAppDispatch } from '@/store/hooks';
import { openNicheEdit } from '@/store/chatBarSlice';
import ConfirmDialog from '@/components/ConfirmDialog';
import useSendDesignsToListings from '@/hooks/useSendDesignsToListings';
import useArtboards from '../board/hooks/useArtboards';
import useRightPanelState from '../board/hooks/useRightPanelState';
import ArtboardCanvas from '../board/partials/ArtboardCanvas';
import BottomToolbar from '../board/partials/BottomToolbar';
import RightPanel from '../board/partials/RightPanel';
import NicheBindingSelector from '../board/partials/NicheBindingSelector';
import ExportDialog from '../board/partials/ExportDialog';
import PromptBuilderDialog from '../board/partials/PromptBuilderDialog';
import DesignEditorView from '../editor/DesignEditorView';
import ProcessingSettingsDialog from './ProcessingSettingsDialog';
import type { ProjectPrompt } from '../gallery/types';
import useWorkspaceTab from './hooks/useWorkspaceTab';
import type { WorkspaceTab } from './hooks/useWorkspaceTab';
import useEditorBatch from './hooks/useEditorBatch';
import useWorkspaceCanvas from './hooks/useWorkspaceCanvas';
import useWorkspaceGeneration from './hooks/useWorkspaceGeneration';
import useWorkspaceActions from './hooks/useWorkspaceActions';
import BulkConfirmDialog from './partials/BulkConfirmDialog';
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
  const dispatch = useAppDispatch();
  const { activeTab, setActiveTab } = useWorkspaceTab();
  const { enqueueSnackbar } = useSnackbar();
  const { isDesktop } = useResponsiveLayout();
  const [mobileRightPanelOpen, setMobileRightPanelOpen] = useState(false);

  const {
    data: project,
    isLoading,
    isError,
  } = useGetProjectQuery(projectId ?? '', { skip: !projectId });
  const [updateProject] = useUpdateProjectMutation();

  // -- Inline project name editing --
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');

  const handleStartEditName = () => {
    setEditingName(project?.name ?? '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = editingName.trim();
    setIsEditingName(false);
    if (!trimmed || !projectId || trimmed === project?.name) return;
    try {
      await updateProject({ projectId, body: { name: trimmed } }).unwrap();
    } catch {
      enqueueSnackbar(t('design.workspace.renameError', 'Failed to rename project'), { variant: 'error' });
    }
  };

  const { data: boardData } = useGetProjectBoardQuery(
    { projectId: projectId ?? '' },
    { skip: !projectId },
  );

  // -- Artboard state --
  const artboardState = useArtboards({
    projectId: projectId ?? '',
    savedLayout: boardData?.board_layout ?? null,
    designs: boardData?.designs,
  });

  // -- Canvas tools/elements/keyboard/text editing --
  const canvas = useWorkspaceCanvas({
    activeTab,
    artboards: artboardState.artboards,
    edges: artboardState.edges,
    selectedIds: artboardState.selectedIds,
    selectArtboard: artboardState.selectArtboard,
    deselectAll: artboardState.deselectAll,
    updateArtboard: artboardState.updateArtboard,
    replaceAll: artboardState.replaceAll,
    moveArtboard: artboardState.moveArtboard,
    resizeArtboard: artboardState.resizeArtboard,
  });

  // -- Right panel state --
  const panelState = useRightPanelState({
    artboards: artboardState.artboards,
    selectedIds: artboardState.selectedIds,
    selectedElementId: canvas.elementSelection.selectedElementId,
    selectedArtboardIdForElement: canvas.elementSelection.selectedArtboardIdForElement,
  });

  // -- Generation --
  const gen = useWorkspaceGeneration({
    projectId: projectId ?? '',
    nicheId: project?.niche ?? null,
    boardDesigns: boardData?.designs,
    selectedArtboard: panelState.artboard,
    addArtboard: artboardState.addArtboard,
    updateArtboard: artboardState.updateArtboard,
    pushHistory: canvas.pushHistory,
    hasSelectedImage: Boolean(panelState.artboard?.imageUrl),
  });

  // -- Editor batch state --
  const editorBatchHook = useEditorBatch();

  // -- PROJ-9 Phase O — Send to Listings (selection-driven via right panel) -
  const sendToListings = useSendDesignsToListings({
    onSuccess: () => artboardState.deselectAll(),
  });
  const boardDesigns = boardData?.designs;
  const designsByArtboardId = useMemo(() => {
    const map = new Map<string, { id: string; status: string; has_design_asset?: boolean }>();
    if (!boardDesigns) return map;
    const byId = new Map(boardDesigns.map((d) => [d.id, d]));
    for (const ab of artboardState.artboards) {
      if (ab.designId && byId.has(ab.designId)) map.set(ab.id, byId.get(ab.designId)!);
    }
    return map;
  }, [artboardState.artboards, boardDesigns]);
  const hasDesignAssetByArtboard = useCallback(
    (artboardId: string) => Boolean(designsByArtboardId.get(artboardId)?.has_design_asset),
    [designsByArtboardId],
  );
  const getSendableDesignIds = useCallback(
    (artboardIds: string[]) => {
      const result: string[] = [];
      for (const id of artboardIds) {
        const design = designsByArtboardId.get(id);
        if (design?.status === 'approved') result.push(design.id);
      }
      return result;
    },
    [designsByArtboardId],
  );
  const handleSendToListings = useCallback(
    (designIds: string[]) => { void sendToListings.send(designIds); },
    [sendToListings],
  );
  const inListingsLabel = t('designs.sendToListings.alreadyInListings', 'In Listings');

  // -- Dialog state --
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleOpenNichePipeline = () => {
    if (project?.niche) {
      dispatch(openNicheEdit(project.niche));
    }
  };

  // -- Actions (delete, export, transfer, analyze, panel) --
  const actions = useWorkspaceActions({
    projectId: projectId ?? '',
    artboardState,
    canvas,
    gen,
    editorBatchHook,
    panelArtboard: panelState.artboard,
    pushHistory: canvas.pushHistory,
    setActiveTab,
  });

  const handlePromptClick = useCallback((p: ProjectPrompt) => { gen.setPrompt(p.prompt_text); }, [gen]);

  // PROJ-30 T3.17 — Render RightPanel once; re-used by the desktop inline
  // pane and the mobile bottom Drawer.
  const rightPanelElement = (
    <RightPanel
      panelState={panelState}
      onUpdateArtboard={artboardState.updateArtboard}
      onResizeArtboard={artboardState.resizeArtboard}
      onAddToEditor={actions.handleAddToEditor}
      onOpenInEditor={actions.handleOpenInEditor}
      onDeleteSelected={actions.handleDeleteSelected}
      onExportSelected={actions.handleExportSelected}
      getSendableDesignIds={getSendableDesignIds}
      onSendToListings={handleSendToListings}
      onUpdateElement={canvas.handleElementUpdate}
      onSelectElement={canvas.handleElementSelect}
      onReorderElement={canvas.canvasElements.reorderElement}
      onDeleteElement={canvas.handleDeleteElement}
      selectedElementId={canvas.elementSelection.selectedElementId}
      prompt={gen.prompt}
      onPromptChange={gen.setPrompt}
      model={gen.aiModel}
      onModelChange={gen.setAiModel}
      bgColor={gen.bgColor}
      onBgColorChange={gen.setBgColor}
      imageCount={gen.imageCount}
      onImageCountChange={gen.setImageCount}
      onGenerate={gen.handleGenerate}
      isGenerating={gen.generation.isGenerating}
      isParallel={gen.isParallel}
      onParallelToggle={gen.setIsParallel}
      onOpenPromptBuilder={gen.handleOpenPromptBuilder}
      onAnalyzeImage={actions.handleAnalyzeImage}
      isAnalyzingImage={gen.imageAnalysis.isAnalyzing}
      hasSelectedImage={gen.hasSelectedImage}
      generationMode={gen.generationMode}
      onGenerationModeChange={gen.setGenerationMode}
      aspectRatio={gen.aspectRatio}
      onAspectRatioChange={gen.setAspectRatio}
      ideas={boardData?.ideas}
      prompts={boardData?.prompts}
      artboards={artboardState.artboards}
      selectedIds={artboardState.selectedIds}
      onInsertSlogan={gen.handleInsertSlogan}
      onPromptClick={handlePromptClick}
      onSelectArtboard={actions.handlePanelSelectArtboard}
      onCreateSkeletonArtboards={gen.handleCreateSkeletonArtboards}
      selectedArtboardId={artboardState.selectedIds.size > 0 ? [...artboardState.selectedIds][0] : undefined}
      projectId={projectId}
      references={boardData?.references}
      onUseAsReference={gen.handleUseAsReference}
      onUseAsPrompt={gen.handleUseAsPrompt}
      sourceImageUrl={gen.sourceImageUrl}
      onClearSourceImage={gen.handleClearSourceImage}
    />
  );

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
        <ContentArea><Skeleton variant="rectangular" sx={{ width: '100%', height: '100%' }} /></ContentArea>
      </WorkspaceRoot>
    );
  }

  // -- Error --
  if (isError || !projectId) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{t('design.workspace.loadError')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/designs')} sx={{ mt: 2 }}>
          {t('design.workspace.backToGallery')}
        </Button>
      </Box>
    );
  }

  return (
    <WorkspaceRoot>
      {/* Header */}
      <HeaderBar>
        <Tooltip title={t('design.workspace.backToGallery')}>
          <IconButton onClick={() => navigate('/designs')} size="small" aria-label={t('design.workspace.backToGallery')}>
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        {isEditingName ? (
          <InputBase
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditingName(false); }}
            autoFocus
            sx={{ fontSize: '1.25rem', fontWeight: 600, px: 1, py: 0.25, borderRadius: 1, border: '1px solid', borderColor: 'divider', minWidth: 120, maxWidth: 280 }}
          />
        ) : (
          <Tooltip title={t('design.workspace.clickToRename', 'Click to rename')}>
            <Typography variant="h6" sx={{ fontWeight: 600, cursor: 'pointer', px: 1, py: 0.25, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }} noWrap onClick={handleStartEditName}>
              {project?.name ?? t('design.workspace.untitled')}
            </Typography>
          </Tooltip>
        )}

        {project && (
          <>
            <NicheBindingSelector projectId={projectId} currentNicheId={project.niche} currentNicheName={project.niche_summary?.name ?? null} />
            {project.niche && (
              <Tooltip title={t('design.workspace.openNicheDrawer', 'Niche Pipeline')}>
                <IconButton size="small" onClick={handleOpenNichePipeline} aria-label={t('design.workspace.openNicheDrawer', 'Niche Pipeline')}>
                  <Inventory2OutlinedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </>
        )}

        <Box sx={{ flex: 1 }} />

        <TabGroup>
          <TabToggle tab="canvas" icon={<AutoFixHighIcon sx={{ fontSize: 16 }} />} label={t('design.workspace.tabCanvas')} active={activeTab === 'canvas'} onClick={setActiveTab} />
          <Badge badgeContent={editorBatchHook.editorBatchCount} color="secondary" invisible={editorBatchHook.editorBatchCount === 0}>
            <TabToggle tab="editor" icon={<BuildOutlinedIcon sx={{ fontSize: 16 }} />} label={t('design.workspace.tabEditor')} active={activeTab === 'editor'} onClick={setActiveTab} />
          </Badge>
        </TabGroup>

        <Tooltip title={t('design.workspace.settings')}>
          <IconButton size="small" aria-label={t('design.workspace.settings')} onClick={() => setSettingsOpen(true)}>
            <SettingsOutlinedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </HeaderBar>

      {/* Content */}
      <ContentArea>
        {activeTab === 'canvas' ? (
          <>
            {/* PROJ-30 T3.17 — On non-desktop viewports (<900px) the
                300px right pane is hidden inline and accessible via a
                bottom Drawer triggered by the FAB below. Canvas takes
                100% width on <md so designers retain full preview. */}
            <CanvasColumn>
              <ArtboardCanvas
                projectId={projectId ?? ''}
                artboards={artboardState.artboards}
                edges={artboardState.edges}
                selectedIds={artboardState.selectedIds}
                selectArtboard={canvas.handleArtboardSelectWithDeselect}
                deselectAll={canvas.handleDeselectAllWithElement}
                selectByRect={artboardState.selectByRect}
                moveArtboard={canvas.moveArtboardWithHistory}
                renameArtboard={artboardState.renameArtboard}
                addArtboard={artboardState.addArtboard}
                addAiImageBoard={artboardState.addAiImageBoard}
                removeArtboards={artboardState.removeArtboards}
                duplicateArtboard={artboardState.duplicateArtboard}
                bringToFront={artboardState.bringToFront}
                sendToBack={artboardState.sendToBack}
                updateArtboard={artboardState.updateArtboard}
                canvasState={canvas.canvasHook.state}
                containerRef={canvas.canvasHook.containerRef}
                setContainerRef={canvas.canvasHook.setContainerRef}
                setStageRef={canvas.canvasHook.setStageRef}
                handleWheel={canvas.canvasHook.handleWheel}
                setPan={canvas.canvasHook.setPan}
                panTo={canvas.canvasHook.panTo}
                resizeArtboard={canvas.resizeArtboardWithHistory}
                selectedElementId={canvas.elementSelection.selectedElementId}
                isFreeTransform={canvas.elementSelection.isFreeTransform}
                onElementSelect={canvas.handleElementSelect}
                onElementDoubleClick={canvas.handleElementDoubleClick}
                onElementUpdate={canvas.handleElementUpdate}
                activeTool={canvas.activeTool}
                onTextInsert={canvas.handleTextInsert}
                onShapeDrawStart={canvas.drawingHandlers.handleDrawStart}
                onShapeDrawMove={canvas.drawingHandlers.handleDrawMove}
                onShapeDrawEnd={canvas.drawingHandlers.handleDrawEnd}
                onPenClick={canvas.penTool.handlePenClick}
                onPenMove={canvas.penTool.handlePenMove}
                onBrushDrawStart={canvas.brushTool.handleBrushStart}
                onBrushDrawMove={canvas.brushTool.handleBrushMove}
                onBrushDrawEnd={canvas.brushTool.handleBrushEnd}
                onAnalyzeImage={actions.handleContextMenuAnalyze}
                onAddToEditor={actions.handleAddToEditor}
                onOpenInEditor={actions.handleOpenInEditor}
                editingElementId={canvas.textEditing.editingElementId}
                hasDesignAsset={hasDesignAssetByArtboard}
                inListingsLabel={inListingsLabel}
              />
              <BottomToolbar
                zoom={canvas.canvasHook.state.zoom}
                onZoomIn={() => canvas.canvasHook.zoomTo(canvas.canvasHook.state.zoom * 1.2)}
                onZoomOut={() => canvas.canvasHook.zoomTo(canvas.canvasHook.state.zoom / 1.2)}
                onFitToView={canvas.handleFitToView}
                onZoomTo={canvas.canvasHook.zoomTo}
                activeTool={canvas.activeTool}
                onToolChange={canvas.setActiveTool}
                onEmojiClick={canvas.emojiPicker.openPicker}
                onUndo={canvas.handleCanvasUndo}
                onRedo={canvas.handleCanvasRedo}
                canUndo={canvas.canvasHistory.canUndo}
                canRedo={canvas.canvasHistory.canRedo}
              />
            </CanvasColumn>
            {isDesktop && rightPanelElement}

            {!isDesktop && (
              <>
                <Tooltip title={t('responsive.designWorkspace.openRightPanel', 'Tools')}>
                  <Fab
                    color="primary"
                    size="medium"
                    onClick={() => setMobileRightPanelOpen(true)}
                    aria-label={t('responsive.designWorkspace.openRightPanel', 'Tools')}
                    sx={{
                      position: 'absolute',
                      right: 16,
                      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
                      zIndex: 1200,
                    }}
                  >
                    <TuneIcon />
                  </Fab>
                </Tooltip>

                <Drawer
                  anchor="bottom"
                  open={mobileRightPanelOpen}
                  onClose={() => setMobileRightPanelOpen(false)}
                  slotProps={{
                    paper: {
                      sx: {
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        maxHeight: 'calc(100dvh - 56px)',
                        height: '80vh',
                        display: 'flex',
                        flexDirection: 'column',
                      },
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 2,
                      py: 1,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {t('responsive.designWorkspace.openRightPanel', 'Tools')}
                    </Typography>
                    <IconButton
                      onClick={() => setMobileRightPanelOpen(false)}
                      aria-label={t('responsive.dialog.closeLabel', 'Close')}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Box>
                  <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                    {rightPanelElement}
                  </Box>
                </Drawer>
              </>
            )}
          </>
        ) : (
          <DesignEditorView projectId={projectId ?? ''} editorBatch={editorBatchHook.editorBatch} onAddToCanvas={actions.handleAddToCanvas} />
        )}
      </ContentArea>

      {/* Dialogs */}
      <ExportDialog open={actions.exportDialogOpen} onClose={() => actions.setExportDialogOpen(false)} artboards={actions.exportArtboardsRef.current} />
      <ConfirmDialog
        open={actions.deleteConfirmOpen}
        title={t('design.canvas.deleteDialogTitle', 'Delete Designs')}
        body={t('design.canvas.deleteDialogBody', { count: actions.pendingDeleteIds.length })}
        confirmLabel={t('design.canvas.deleteConfirm', 'Delete')}
        cancelLabel={t('design.canvas.deleteCancel', 'Cancel')}
        onConfirm={actions.handleDeleteConfirm}
        onCancel={actions.handleDeleteCancel}
        isLoading={actions.isDeletingFromServer}
      />
      <ProcessingSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <BulkConfirmDialog
        open={Boolean(sendToListings.pendingConfirm)}
        count={sendToListings.pendingConfirm?.designIds.length ?? 0}
        isSending={sendToListings.isSending}
        onConfirm={() => { void sendToListings.confirmPending(); }}
        onCancel={sendToListings.cancelPending}
      />
      <PromptBuilderDialog
        open={gen.promptBuilderOpen}
        onClose={gen.handleClosePromptBuilder}
        ideas={boardData?.ideas ?? []}
        sources={gen.promptBuilder.sources}
        selectedSloganId={gen.promptBuilder.selectedSloganId}
        imageUrl={gen.promptBuilder.imageUrl}
        variants={gen.promptBuilder.variants}
        preview={gen.promptBuilder.preview}
        isPreviewLoading={gen.promptBuilder.isPreviewLoading}
        isSaving={gen.promptBuilder.isSaving}
        hasNiche={gen.promptBuilder.hasNiche}
        presets={gen.promptBuilder.presets}
        nicheKeywords={gen.promptBuilder.nicheKeywords}
        researchPreview={gen.promptBuilder.researchPreview}
        isResearchLoading={gen.promptBuilder.isResearchLoading}
        onAnalyzeImage={actions.handleAnalyzeImage}
        isAnalyzingImage={gen.imageAnalysis.isAnalyzing}
        imageAnalysisResult={gen.imageAnalysis.lastPrompt}
        toggleSource={gen.promptBuilder.toggleSource}
        setSelectedSloganId={gen.promptBuilder.setSelectedSloganId}
        setImageUrl={gen.promptBuilder.setImageUrl}
        setVariants={gen.promptBuilder.setVariants}
        fetchPreview={gen.promptBuilder.fetchPreview}
        applyPreset={gen.promptBuilder.applyPreset}
        savePreset={gen.promptBuilder.savePreset}
        deletePreset={gen.promptBuilder.deletePreset}
        buildAndSave={gen.promptBuilder.buildAndSave}
      />
    </WorkspaceRoot>
  );
};

export default DesignWorkspaceView;
