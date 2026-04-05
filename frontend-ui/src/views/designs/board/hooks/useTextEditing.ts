import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasElement, TextElementProps } from '../types';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface TextEditingState {
  /** Whether inline text editing is active */
  isEditing: boolean;
  /** ID of the element being edited */
  editingElementId: string | null;
  /** Artboard containing the edited element */
  editingArtboardId: string | null;
}

interface UseTextEditingParams {
  /** Container element of the Konva stage (for positioning overlay) */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Canvas zoom level */
  zoom: number;
  /** Canvas pan offset X */
  panX: number;
  /** Canvas pan offset Y */
  panY: number;
  /** Callback to commit text change */
  onCommit: (artboardId: string, elementId: string, text: string) => void;
}

interface UseTextEditingReturn extends TextEditingState {
  /** Start editing a text element (call on double-click) */
  startEditing: (
    artboardId: string,
    element: CanvasElement<'text'>,
    artboardX: number,
    artboardY: number,
  ) => void;
  /** Stop editing (commits or cancels) */
  stopEditing: () => void;
  /** The textarea DOM element ref (render this in portal/overlay) */
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
  const elementRef = useRef<CanvasElement<'text'> | null>(null);
  const artboardPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const stopEditing = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea && state.editingElementId && state.editingArtboardId) {
      const newText = textarea.value;
      if (newText !== originalTextRef.current && newText.trim()) {
        onCommit(state.editingArtboardId, state.editingElementId, newText);
      }
    }

    // Remove textarea from DOM
    if (textareaRef.current?.parentElement) {
      textareaRef.current.parentElement.removeChild(textareaRef.current);
    }
    textareaRef.current = null;
    elementRef.current = null;

    setState({
      isEditing: false,
      editingElementId: null,
      editingArtboardId: null,
    });
  }, [state.editingElementId, state.editingArtboardId, onCommit]);

  const cancelEditing = useCallback(() => {
    // Remove textarea without committing
    if (textareaRef.current?.parentElement) {
      textareaRef.current.parentElement.removeChild(textareaRef.current);
    }
    textareaRef.current = null;
    elementRef.current = null;

    setState({
      isEditing: false,
      editingElementId: null,
      editingArtboardId: null,
    });
  }, []);

  const startEditing = useCallback(
    (
      artboardId: string,
      element: CanvasElement<'text'>,
      artboardX: number,
      artboardY: number,
    ) => {
      const container = containerRef.current;
      if (!container) return;

      const props = element.props as TextElementProps;
      originalTextRef.current = props.text;
      elementRef.current = element;
      artboardPosRef.current = { x: artboardX, y: artboardY };

      // Calculate screen position of the text element
      const screenX = (artboardX + element.x) * zoom + panX;
      const screenY = (artboardY + element.y) * zoom + panY;
      const screenWidth = element.width * zoom;
      const scaledFontSize = props.fontSize * zoom;

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
      textarea.style.letterSpacing = `${(props.letterSpacing ?? 0) * zoom}px`;
      textarea.style.lineHeight = String(props.lineHeight ?? 1.2);
      textarea.style.border = '2px solid #4A9EFF';
      textarea.style.borderRadius = '2px';
      textarea.style.outline = 'none';
      textarea.style.background = 'rgba(0,0,0,0.7)';
      textarea.style.padding = '2px 4px';
      textarea.style.resize = 'none';
      textarea.style.overflow = 'hidden';
      textarea.style.zIndex = '1000';
      textarea.style.boxSizing = 'border-box';
      textarea.style.transformOrigin = 'top left';

      container.appendChild(textarea);
      textareaRef.current = textarea;

      // Auto-focus and select all
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.select();
      });

      // Handle blur → commit
      textarea.addEventListener('blur', () => {
        // Short delay to allow Escape key handler to run first
        setTimeout(() => {
          if (textareaRef.current === textarea) {
            stopEditing();
          }
        }, 50);
      });

      // Handle keydown
      textarea.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cancelEditing();
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          stopEditing();
        }
      });

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
    [containerRef, zoom, panX, panY, stopEditing, cancelEditing],
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
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
