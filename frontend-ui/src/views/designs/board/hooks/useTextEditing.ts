import { useCallback, useEffect, useRef, useState } from 'react';
import { alpha } from '@mui/material/styles';
import { COLORS } from '@/style/constants';
import type { CanvasElement, TextElementProps } from '../types';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface TextEditingState {
  isEditing: boolean;
  editingElementId: string | null;
  editingArtboardId: string | null;
}

interface UseTextEditingParams {
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  panX: number;
  panY: number;
  onCommit: (artboardId: string, elementId: string, text: string) => void;
}

interface UseTextEditingReturn extends TextEditingState {
  startEditing: (
    artboardId: string,
    element: CanvasElement<'text'>,
    artboardX: number,
    artboardY: number,
  ) => void;
  stopEditing: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useTextEditing = ({
  containerRef,
  zoom,
  panX,
  panY,
  onCommit,
}: UseTextEditingParams): UseTextEditingReturn => {
  const [state, setState] = useState<TextEditingState>({
    isEditing: false,
    editingElementId: null,
    editingArtboardId: null,
  });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const originalTextRef = useRef<string>('');
  // Use refs to avoid stale closures in event handlers
  const editingElementIdRef = useRef<string | null>(null);
  const editingArtboardIdRef = useRef<string | null>(null);
  const onCommitRef = useRef(onCommit);
  /** Teardown function for canvas focus-prevention listeners */
  const canvasCleanupRef = useRef<(() => void) | null>(null);
  // Keep transform values in refs so startEditing always reads latest
  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  useEffect(() => {
    onCommitRef.current = onCommit;
    zoomRef.current = zoom;
    panXRef.current = panX;
    panYRef.current = panY;
  });

  const cleanup = useCallback(() => {
    canvasCleanupRef.current?.();
    canvasCleanupRef.current = null;
    if (textareaRef.current?.parentElement) {
      textareaRef.current.parentElement.removeChild(textareaRef.current);
    }
    textareaRef.current = null;
    editingElementIdRef.current = null;
    editingArtboardIdRef.current = null;
    setState({ isEditing: false, editingElementId: null, editingArtboardId: null });
  }, []);

  const stopEditing = useCallback(() => {
    const textarea = textareaRef.current;
    const elId = editingElementIdRef.current;
    const abId = editingArtboardIdRef.current;

    if (textarea && elId && abId) {
      const newText = textarea.value;
      if (newText !== originalTextRef.current && newText.trim()) {
        onCommitRef.current(abId, elId, newText);
      }
    }
    cleanup();
  }, [cleanup]);

  const cancelEditing = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Stable ref for stopEditing/cancelEditing so textarea event listeners never go stale
  const stopEditingRef = useRef(stopEditing);
  const cancelEditingRef = useRef(cancelEditing);
  useEffect(() => {
    stopEditingRef.current = stopEditing;
    cancelEditingRef.current = cancelEditing;
  });

  const startEditing = useCallback(
    (
      artboardId: string,
      element: CanvasElement<'text'>,
      artboardX: number,
      artboardY: number,
    ) => {
      // Clean up any existing editing session
      if (textareaRef.current) {
        cleanup();
      }

      const container = containerRef.current;
      if (!container) return;

      const props = element.props as TextElementProps;
      originalTextRef.current = props.text;
      editingElementIdRef.current = element.id;
      editingArtboardIdRef.current = artboardId;

      // Read latest transform values from refs (not stale closure)
      const z = zoomRef.current;
      const px = panXRef.current;
      const py = panYRef.current;

      // Calculate screen position of the text element
      const screenX = (artboardX + element.x) * z + px;
      const screenY = (artboardY + element.y) * z + py;
      const screenWidth = element.width * z;
      const scaledFontSize = props.fontSize * z;

      // Create textarea overlay
      const textarea = document.createElement('textarea');
      textarea.value = props.text;
      textarea.style.position = 'absolute';
      textarea.style.left = `${screenX}px`;
      textarea.style.top = `${screenY}px`;
      textarea.style.width = `${Math.max(screenWidth, 100)}px`;
      textarea.style.minHeight = `${scaledFontSize * 2}px`;
      textarea.style.fontSize = `${scaledFontSize}px`;
      textarea.style.fontFamily = props.fontFamily;
      textarea.style.fontWeight = String(props.fontWeight ?? 400);
      textarea.style.fontStyle = props.fontStyle ?? 'normal';
      textarea.style.color = props.fill;
      textarea.style.textAlign = props.align;
      textarea.style.letterSpacing = `${(props.letterSpacing ?? 0) * z}px`;
      textarea.style.lineHeight = String(props.lineHeight ?? 1.2);
      textarea.style.border = `2px solid ${COLORS.selection}`;
      textarea.style.borderRadius = '2px';
      textarea.style.outline = 'none';
      textarea.style.background = alpha(COLORS.black, 0.7);
      textarea.style.padding = '2px 4px';
      textarea.style.resize = 'none';
      textarea.style.overflow = 'hidden';
      textarea.style.zIndex = '1000';
      textarea.style.boxSizing = 'border-box';
      textarea.style.transformOrigin = 'top left';

      // Prevent clicks on textarea from reaching Konva canvas (would trigger deselectAll)
      textarea.addEventListener('mousedown', (e) => e.stopPropagation());
      textarea.addEventListener('pointerdown', (e) => e.stopPropagation());

      // When the user clicks the Konva canvas while the textarea is active, commit the
      // text edit and let Konva handle the click normally. Without this, the canvas
      // mousedown steals focus from the textarea before blur fires, causing a race.
      const canvasEl = container.querySelector('canvas');
      const handleCanvasMouseDown = () => {
        if (textareaRef.current) {
          // Commit immediately — the blur handler will no-op because cleanup already ran
          stopEditingRef.current();
        }
      };
      canvasEl?.addEventListener('mousedown', handleCanvasMouseDown, true);

      // Store reference to remove listeners on cleanup
      const cleanupCanvasListeners = () => {
        canvasEl?.removeEventListener('mousedown', handleCanvasMouseDown, true);
      };

      canvasCleanupRef.current = cleanupCanvasListeners;

      container.appendChild(textarea);
      textareaRef.current = textarea;

      // Focus after DOM is ready — double rAF to survive React re-render flush
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (textareaRef.current === textarea) {
            textarea.focus();
            textarea.select();
          }
        });
      });

      // Handle blur → commit
      const handleBlur = () => {
        setTimeout(() => {
          if (textareaRef.current === textarea) {
            stopEditingRef.current();
          }
        }, 150);
      };
      textarea.addEventListener('blur', handleBlur);

      // Handle keydown
      const handleKeydown = (e: KeyboardEvent) => {
        e.stopPropagation(); // Prevent canvas keyboard shortcuts from firing
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelEditingRef.current();
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          stopEditingRef.current();
        }
      };
      textarea.addEventListener('keydown', handleKeydown);

      // Auto-resize textarea height
      textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      });

      setState({
        isEditing: true,
        editingElementId: element.id,
        editingArtboardId: artboardId,
      });
    },
    // Only depend on stable refs — no zoom/panX/panY (read from refs inside)
    [containerRef, cleanup],
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      canvasCleanupRef.current?.();
      canvasCleanupRef.current = null;
      if (textareaRef.current?.parentElement) {
        textareaRef.current.parentElement.removeChild(textareaRef.current);
      }
    };
  }, []);

  return {
    ...state,
    startEditing,
    stopEditing,
    textareaRef,
  };
};

export default useTextEditing;
