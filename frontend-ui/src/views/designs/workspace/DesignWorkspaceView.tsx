import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArtboardData, BackgroundColor, DesignModel } from '../board/types';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, IconButton, InputBase, Skeleton, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useGetProjectQuery, useGetProjectBoardQuery, useDeleteDesignMutation, useUpdateProjectMutation } from '@/store/designSlice';
import ConfirmDialog from '@/components/ConfirmDialog';
import useArtboardCanvas from '../board/hooks/useArtboardCanvas';
import useArtboards from '../board/hooks/useArtboards';
import useCanvasHistory from '../board/hooks/useCanvasHistory';
import useCanvasElements from '../board/hooks/useCanvasElements';
import useElementSelection from '../board/hooks/useElementSelection';
import useRightPanelState from '../board/hooks/useRightPanelState';
import useTextEditing from '../board/hooks/useTextEditing';
import useDrawingHandlers from '../board/hooks/useDrawingHandlers';
import usePenTool from '../board/hooks/usePenTool';
import useBrushTool from '../board/hooks/useBrushTool';
import useEmojiPicker from '../board/hooks/useEmojiPicker';
import rasterizeEmoji from '../board/utils/rasterizeEmoji';
import { useGeneration } from '../board/hooks/useGeneration';
import ArtboardCanvas from '../board/partials/ArtboardCanvas';
import BottomToolbar from '../board/partials/BottomToolbar';
import type { CanvasTool } from '../board/types';
import RightPanel from '../board/partials/RightPanel';
import NicheBindingSelector from '../board/partials/NicheBindingSelector';
import ExportDialog from '../board/partials/ExportDialog';
import PromptBuilderDialog from '../board/partials/PromptBuilderDialog';
import { usePromptBuilder } from '../board/hooks/usePromptBuilder';
import { useImageAnalysis } from '../board/hooks/useImageAnalysis';
import DesignEditorView from '../editor/DesignEditorView';
import ProcessingSettingsDialog from './ProcessingSettingsDialog';
import { NichePipeline } from '../../niches/list/partials/NichePipeline';
import type { ProjectPrompt } from '../gallery/types';
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

  // -- Element selection --
  const elementSelection = useElementSelection();

  // -- Canvas elements CRUD --
  const canvasElements = useCanvasElements({
    artboards: artboardState.artboards,
    edges: artboardState.edges,
    updateArtboard: artboardState.updateArtboard,
    pushSnapshot: canvasHistory.pushSnapshot,
  });

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

  // Shift-key held → free-scale (keepRatio: false) while shift is down
  useEffect(() => {
    if (activeTab !== 'canvas') return;
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') elementSelection.enterFreeTransform();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') elementSelection.exitFreeTransform();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [activeTab, elementSelection]);

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

  // Ref to track text editing state (avoids hook ordering issue with textEditing defined later)
  const isTextEditingRef = useRef(false);

  // Keyboard shortcuts: Delete/Backspace to remove, Escape to deselect element
  useEffect(() => {
    if (activeTab !== 'canvas') return;
    const handler = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      // Escape: deselect element — but not if text editing is active (textarea handles its own Escape)
      if (e.key === 'Escape') {
        if (isTextEditingRef.current) return;
        if (elementSelection.selectedElementId) {
          e.preventDefault();
          elementSelection.deselectElement();
        }
        return;
      }

      // Delete/Backspace: remove selected element or artboard(s)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        const elId = elementSelection.selectedElementId;
        const abId = elementSelection.selectedArtboardIdForElement;

        // Priority 1: delete selected element
        if (elId && abId) {
          e.preventDefault();
          canvasElements.removeElement(abId, elId);
          elementSelection.deselectElement();
          return;
        }

        // Priority 2: delete selected artboard(s)
        const selectedAbIds = Array.from(artboardState.selectedIds);
        if (selectedAbIds.length > 0) {
          e.preventDefault();
          artboardState.removeArtboards(selectedAbIds);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, elementSelection, canvasElements, artboardState]);

  const panelState = useRightPanelState({
    artboards: artboardState.artboards,
    selectedIds: artboardState.selectedIds,
    selectedElementId: elementSelection.selectedElementId,
    selectedArtboardIdForElement: elementSelection.selectedArtboardIdForElement,
  });

  // -- Prompt state (GenerationZone in RightPanel owns the UI) --
  const [prompt, setPrompt] = useState('');
  const [aiModel, setAiModel] = useState<DesignModel>('google/gemini-3.1-flash-preview-image-generation');
  const [bgColor, setBgColor] = useState<BackgroundColor>('light_gray');
  const [imageCount, setImageCount] = useState(1);
  const [isParallel, setIsParallel] = useState(false);
  const [generationMode, setGenerationMode] = useState<import('../board/partials/GenerationZone').GenerationMode>('text_to_image');
  const [aspectRatio, setAspectRatio] = useState<import('../board/partials/GenerationZone').AspectRatio>('1:1');
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);

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

  // -- Element selection handlers --
  const handleElementSelect = useCallback(
    (artboardId: string, elementId: string) => {
      elementSelection.selectElement(artboardId, elementId);
      // Ensure the parent artboard is selected too
      artboardState.selectArtboard(artboardId, false);
    },
    [elementSelection, artboardState],
  );

  // -- Shape drawing --
  const drawingHandlers = useDrawingHandlers({
    activeTool,
    addElement: canvasElements.addElement,
    setActiveTool,
    onElementSelect: handleElementSelect,
  });

  // -- Pen tool --
  const penTool = usePenTool({
    activeTool,
    addElement: canvasElements.addElement,
    setActiveTool,
    onElementSelect: handleElementSelect,
  });

  // -- Brush tool --
  const brushTool = useBrushTool({
    activeTool,
    addElement: canvasElements.addElement,
    updateElement: canvasElements.updateElement,
    getElements: canvasElements.getElements,
    onElementSelect: handleElementSelect,
  });

  // -- Emoji picker --
  const handleEmojiSelected = useCallback(
    (emoji: string) => {
      const dataUrl = rasterizeEmoji(emoji);
      if (!dataUrl) return;

      // Find target artboard: selected or first
      const targetId =
        artboardState.selectedIds.size > 0
          ? [...artboardState.selectedIds][0]
          : artboardState.artboards[0]?.id;

      if (!targetId) {
        enqueueSnackbar(t('design.canvas.noArtboard', 'Create an artboard first'), {
          variant: 'warning',
        });
        return;
      }

      const ab = artboardState.artboards.find((a) => a.id === targetId);
      if (!ab) return;

      const size = 64;
      const newEl = canvasElements.addElement(
        targetId,
        'emoji',
        { emoji, dataUrl },
        {
          x: Math.round(ab.width / 2 - size / 2),
          y: Math.round(ab.height / 2 - size / 2),
          width: size,
          height: size,
        },
      );

      if (newEl) {
        handleElementSelect(targetId, newEl.id);
      }
    },
    [artboardState, canvasElements, handleElementSelect, enqueueSnackbar, t],
  );

  const emojiPicker = useEmojiPicker({ onEmojiSelected: handleEmojiSelected });

  // -- Text editing --
  const textEditing = useTextEditing({
    containerRef: canvasHook.containerRef,
    zoom: canvasHook.state.zoom,
    panX: canvasHook.state.panX,
    panY: canvasHook.state.panY,
    onCommit: useCallback(
      (artboardId: string, elementId: string, text: string) => {
        canvasElements.updateElementProps(artboardId, elementId, { text });
      },
      [canvasElements],
    ),
  });
  // Keep ref in sync for keyboard handler (defined before textEditing)
  isTextEditingRef.current = textEditing.isEditing;

  const handleElementDoubleClick = useCallback(
    (artboardId: string, elementId: string) => {
      // If the element is text, start inline editing
      const ab = artboardState.artboards.find((a) => a.id === artboardId);
      const el = ab?.layers.find((l) => l.id === elementId);
      if (el?.type === 'text') {
        elementSelection.selectElement(artboardId, elementId);
        textEditing.startEditing(
          artboardId,
          el as import('../board/types').CanvasElement<'text'>,
          ab!.x,
          ab!.y,
        );
        return;
      }
      elementSelection.selectElement(artboardId, elementId);
      elementSelection.enterFreeTransform();
    },
    [elementSelection, artboardState.artboards, textEditing],
  );

  // -- Text tool insertion --
  const handleTextInsert = useCallback(
    (artboardId: string, localX: number, localY: number) => {
      const newEl = canvasElements.addElement(
        artboardId,
        'text',
        {
          text: 'Type here',
          fontFamily: 'Inter',
          fontSize: 24,
          fontWeight: 400,
          fontStyle: 'normal',
          fill: '#000000',
          align: 'left',
          letterSpacing: 0,
          lineHeight: 1.2,
        },
        {
          x: localX,
          y: localY,
          width: 200,
          height: 40,
        },
      );

      if (newEl) {
        elementSelection.selectElement(artboardId, newEl.id);
        // Switch tool first, then start editing after React settles
        setActiveTool('cursor');
        const ab = artboardState.artboards.find((a) => a.id === artboardId);
        if (ab) {
          requestAnimationFrame(() => {
            textEditing.startEditing(
              artboardId,
              newEl,
              ab.x,
              ab.y,
            );
          });
        }
      } else {
        setActiveTool('cursor');
      }
    },
    [canvasElements, elementSelection, artboardState.artboards, textEditing],
  );

  const handleElementUpdate = useCallback(
    (artboardId: string, elementId: string, patch: Partial<Omit<import('../board/types').CanvasElement, 'id' | 'type'>>) => {
      canvasElements.updateElement(artboardId, elementId, patch);
    },
    [canvasElements],
  );

  // -- Delete selected element --
  const handleDeleteElement = useCallback(
    (artboardId: string, elementId: string) => {
      canvasElements.removeElement(artboardId, elementId);
      elementSelection.deselectElement();
    },
    [canvasElements, elementSelection],
  );

  // Wrap artboard select to deselect element when clicking artboard background
  // Skip element deselection while text editing is active (canvas clicks are suppressed)
  const handleArtboardSelectWithDeselect = useCallback(
    (id: string, additive: boolean) => {
      if (!isTextEditingRef.current) {
        elementSelection.deselectElement();
      }
      artboardState.selectArtboard(id, additive);
    },
    [elementSelection, artboardState],
  );

  // Wrap deselectAll to also deselect element — skip while text editing is active
  const handleDeselectAllWithElement = useCallback(() => {
    if (isTextEditingRef.current) return;
    elementSelection.deselectElement();
    artboardState.deselectAll();
  }, [elementSelection, artboardState]);

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
  const [promptBuilderOpen, setPromptBuilderOpen] = useState(false);
  const [nichePipelineOpen, setNichePipelineOpen] = useState(false);

  // -- Prompt Builder hook --
  const promptBuilder = usePromptBuilder(
    projectId ?? '',
    project?.niche ?? null,
  );

  // -- Image analysis hook (G13) --
  const imageAnalysis = useImageAnalysis(projectId ?? '');

  // Fill prompt when analysis completes
  useEffect(() => {
    if (imageAnalysis.lastPrompt) {
      setPrompt(imageAnalysis.lastPrompt);
    }
  }, [imageAnalysis.lastPrompt]);

  const handleOpenPromptBuilder = useCallback(() => {
    promptBuilder.reset();
    setPromptBuilderOpen(true);
  }, [promptBuilder]);

  const handleClosePromptBuilder = useCallback(() => {
    setPromptBuilderOpen(false);
  }, []);

  // G13: analyze image from prompt bar or context menu
  const handleAnalyzeImage = useCallback(() => {
    // If an artboard with image is selected, analyze that
    const selectedAb = panelState.artboard;
    if (selectedAb?.imageUrl && selectedAb?.designId) {
      void imageAnalysis.triggerAnalysis(
        selectedAb.designId,
        selectedAb.imageUrl,
        selectedAb.designId,
      );
      return;
    }

    // Otherwise open file picker
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      // Add as reference artboard, then we'd need a design ID to analyze
      // For now, just fill prompt with a placeholder
      artboardState.addArtboard({
        label: 'Reference',
        kind: 'regular',
        width: 280,
        height: 280,
        imageUrl: url,
      });
      enqueueSnackbar(
        t('design.actions.imageAdded', 'Image added as reference artboard'),
        { variant: 'info' },
      );
    };
    input.click();
  }, [panelState.artboard, imageAnalysis, artboardState, enqueueSnackbar, t]);

  // G13: context menu analyze handler
  const handleContextMenuAnalyze = useCallback(
    (artboardId: string) => {
      const ab = artboardState.artboards.find((a) => a.id === artboardId);
      if (!ab?.imageUrl || !ab?.designId) return;
      void imageAnalysis.triggerAnalysis(ab.designId, ab.imageUrl, ab.designId);
    },
    [artboardState.artboards, imageAnalysis],
  );

  const hasSelectedImage = Boolean(panelState.artboard?.imageUrl);

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

  // Insert slogan text into prompt bar
  const handleInsertSlogan = useCallback(
    (sloganText: string) => {
      setPrompt(sloganText);
    },
    [],
  );

  // Phase G: prompt card click -> load into prompt bar
  const handlePromptClick = useCallback(
    (p: ProjectPrompt) => {
      setPrompt(p.prompt_text);
    },
    [],
  );

  // Phase I: Use reference image as source for image-to-image generation
  const handleUseAsReference = useCallback(
    (imageUrl: string) => {
      setGenerationMode('image_to_image');
      setSourceImageUrl(imageUrl);
    },
    [],
  );

  // Phase I7: Clear source image reference
  const handleClearSourceImage = useCallback(() => {
    setSourceImageUrl(null);
  }, []);

  // Phase I: Copy analysis text into prompt bar
  const handleUseAsPrompt = useCallback(
    (analysisText: string) => {
      setPrompt(analysisText);
    },
    [],
  );

  // Phase G: add reference artboard from slogan pool product
  const handleAddReferenceArtboard = useCallback(
    (imageUrl: string) => {
      artboardState.addArtboard({
        label: 'Reference',
        kind: 'regular',
        width: 280,
        height: 280,
        imageUrl,
      });
    },
    [artboardState],
  );

  // Phase G: create skeleton artboards when bulk generate / generate all fires (Gap 1 & 4)
  const handleCreateSkeletonArtboards = useCallback(
    (items: Array<{ runId: string; label: string }>) => {
      pushHistory();
      for (const item of items) {
        artboardState.addArtboard({
          label: item.label,
          kind: 'ai',
          width: 280,
          height: 280,
          isGenerating: true,
        });
      }
    },
    [artboardState, pushHistory],
  );

  // Phase G: select artboard from panel list
  const handlePanelSelectArtboard = useCallback(
    (id: string) => {
      artboardState.selectArtboard(id, false);
    },
    [artboardState],
  );

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
        ...(sourceImageUrl ? { source_image_url: sourceImageUrl } : {}),
      });
      // Clear source image after successful trigger
      setSourceImageUrl(null);
    } catch {
      artboardState.updateArtboard(skeletonAb.id, { isGenerating: false });
    }
  }, [prompt, generation, artboardState, aiModel, bgColor, pushHistory, sourceImageUrl]);

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

        {isEditingName ? (
          <InputBase
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveName();
              if (e.key === 'Escape') setIsEditingName(false);
            }}
            autoFocus
            sx={{
              fontSize: '1.25rem',
              fontWeight: 600,
              px: 1,
              py: 0.25,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              minWidth: 120,
              maxWidth: 280,
            }}
          />
        ) : (
          <Tooltip title={t('design.workspace.clickToRename', 'Click to rename')}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                cursor: 'pointer',
                px: 1,
                py: 0.25,
                borderRadius: 1,
                '&:hover': { bgcolor: 'action.hover' },
              }}
              noWrap
              onClick={handleStartEditName}
            >
              {project?.name ?? t('design.workspace.untitled')}
            </Typography>
          </Tooltip>
        )}

        {project && (
          <>
            <NicheBindingSelector
              projectId={projectId}
              currentNicheId={project.niche}
              currentNicheName={project.niche_summary?.name ?? null}
            />
            {project.niche && (
              <Tooltip title={t('design.workspace.openNicheDrawer', 'Niche Pipeline')}>
                <IconButton
                  size="small"
                  onClick={() => setNichePipelineOpen(true)}
                  aria-label={t('design.workspace.openNicheDrawer', 'Niche Pipeline')}
                >
                  <Inventory2OutlinedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </>
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
                selectArtboard={handleArtboardSelectWithDeselect}
                deselectAll={handleDeselectAllWithElement}
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
                selectedElementId={elementSelection.selectedElementId}
                isFreeTransform={elementSelection.isFreeTransform}
                onElementSelect={handleElementSelect}
                onElementDoubleClick={handleElementDoubleClick}
                onElementUpdate={handleElementUpdate}
                activeTool={activeTool}
                onTextInsert={handleTextInsert}
                onShapeDrawStart={drawingHandlers.handleDrawStart}
                onShapeDrawMove={drawingHandlers.handleDrawMove}
                onShapeDrawEnd={drawingHandlers.handleDrawEnd}
                onPenClick={penTool.handlePenClick}
                onPenMove={penTool.handlePenMove}
                onBrushDrawStart={brushTool.handleBrushStart}
                onBrushDrawMove={brushTool.handleBrushMove}
                onBrushDrawEnd={brushTool.handleBrushEnd}
                onAnalyzeImage={handleContextMenuAnalyze}
                editingElementId={textEditing.editingElementId}
              />
              <BottomToolbar
                zoom={canvasHook.state.zoom}
                onZoomIn={() => canvasHook.zoomTo(canvasHook.state.zoom * 1.2)}
                onZoomOut={() => canvasHook.zoomTo(canvasHook.state.zoom / 1.2)}
                onFitToView={handleFitToView}
                onZoomTo={canvasHook.zoomTo}
                activeTool={activeTool}
                onToolChange={setActiveTool}

                onEmojiClick={emojiPicker.openPicker}
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
              onOpenInEditor={handleOpenInEditor}
              onDeleteSelected={handleDeleteSelected}
              onExportSelected={handleExportSelected}
              onUpdateElement={handleElementUpdate}
              onSelectElement={handleElementSelect}
              onReorderElement={canvasElements.reorderElement}
              onDeleteElement={handleDeleteElement}
              selectedElementId={elementSelection.selectedElementId}
              // Generation zone props
              prompt={prompt}
              onPromptChange={setPrompt}
              model={aiModel}
              onModelChange={setAiModel}
              bgColor={bgColor}
              onBgColorChange={setBgColor}
              imageCount={imageCount}
              onImageCountChange={setImageCount}
              onGenerate={handleGenerate}
              isGenerating={generation.isGenerating}
              isParallel={isParallel}
              onParallelToggle={setIsParallel}
              onOpenPromptBuilder={handleOpenPromptBuilder}
              onAnalyzeImage={handleAnalyzeImage}
              isAnalyzingImage={imageAnalysis.isAnalyzing}
              hasSelectedImage={hasSelectedImage}
              generationMode={generationMode}
              onGenerationModeChange={setGenerationMode}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              // Phase G props
              ideas={boardData?.ideas}
              prompts={boardData?.prompts}
              artboards={artboardState.artboards}
              selectedIds={artboardState.selectedIds}
              onInsertSlogan={handleInsertSlogan}
              onPromptClick={handlePromptClick}
              onAddReferenceArtboard={handleAddReferenceArtboard}
              onSelectArtboard={handlePanelSelectArtboard}
              onCreateSkeletonArtboards={handleCreateSkeletonArtboards}
              selectedArtboardId={artboardState.selectedIds?.[0]}
              projectId={projectId}
              // Phase I: References
              references={boardData?.references}
              onUseAsReference={handleUseAsReference}
              onUseAsPrompt={handleUseAsPrompt}
              sourceImageUrl={sourceImageUrl}
              onClearSourceImage={handleClearSourceImage}
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
      <PromptBuilderDialog
        open={promptBuilderOpen}
        onClose={handleClosePromptBuilder}
        ideas={boardData?.ideas ?? []}
        sources={promptBuilder.sources}
        selectedSloganId={promptBuilder.selectedSloganId}
        imageUrl={promptBuilder.imageUrl}
        variants={promptBuilder.variants}
        preview={promptBuilder.preview}
        isPreviewLoading={promptBuilder.isPreviewLoading}
        isSaving={promptBuilder.isSaving}
        hasNiche={promptBuilder.hasNiche}
        presets={promptBuilder.presets}
        nicheKeywords={promptBuilder.nicheKeywords}
        researchPreview={promptBuilder.researchPreview}
        isResearchLoading={promptBuilder.isResearchLoading}
        onAnalyzeImage={handleAnalyzeImage}
        isAnalyzingImage={imageAnalysis.isAnalyzing}
        imageAnalysisResult={imageAnalysis.lastPrompt}
        toggleSource={promptBuilder.toggleSource}
        setSelectedSloganId={promptBuilder.setSelectedSloganId}
        setImageUrl={promptBuilder.setImageUrl}
        setVariants={promptBuilder.setVariants}
        fetchPreview={promptBuilder.fetchPreview}
        applyPreset={promptBuilder.applyPreset}
        savePreset={promptBuilder.savePreset}
        deletePreset={promptBuilder.deletePreset}
        buildAndSave={promptBuilder.buildAndSave}
      />
      {project?.niche && (
        <NichePipeline
          open={nichePipelineOpen}
          mode="edit"
          selectedId={project.niche}
          onClose={() => setNichePipelineOpen(false)}
        />
      )}
    </WorkspaceRoot>
  );
};

export default DesignWorkspaceView;
