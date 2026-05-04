import { useEffect, useRef, useState } from 'react';
import { Box, Button, Stack } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import { useTranslation } from 'react-i18next';

interface SaveSnippetToolbarProps {
  /** Container ref — toolbar listens for `mouseup` on this element + descendants. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Called when "Save as Keywords" clicked with the selected text + optional sourceUrl. */
  onSaveKeywords: (selectedText: string, sourceUrl?: string) => void;
  /** Called when "Save as Notes" clicked with the selected text + optional sourceUrl. */
  onSaveNotes: (selectedText: string, sourceUrl?: string) => void;
}

interface ToolbarPosition {
  /** Viewport-relative px (uses position: fixed). */
  top: number;
  left: number;
  selectedText: string;
  /** Source URL of the closest [data-source-url] ancestor of the selection anchor (e.g. SourceCard). */
  sourceUrl?: string;
}

/** Walk up from a node to find the nearest ancestor with a `data-source-url` attribute. */
const findSourceUrl = (node: Node | null): string | undefined => {
  let el: Node | null = node;
  // If anchor is a TextNode, start from its parentElement
  if (el && el.nodeType !== 1 /* ELEMENT_NODE */) {
    el = (el as Node).parentElement;
  }
  while (el && el.nodeType === 1) {
    const url = (el as HTMLElement).getAttribute?.('data-source-url');
    if (url) return url;
    el = (el as HTMLElement).parentElement;
  }
  return undefined;
};

/** Toolbar height + arrow — used to flip above/below the selection. */
const TOOLBAR_HEIGHT = 40;
/** Gap between the selection bounding rect and the toolbar. */
const TOOLBAR_OFFSET = 8;

const ToolbarRoot = styled(Box)(({ theme }) => ({
  position: 'fixed',
  zIndex: theme.zIndex.tooltip + 10,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: `${theme.spacing(0.5)} ${theme.spacing(0.75)}`,
  borderRadius: 8,
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  backdropFilter: 'blur(12px)',
  border: `1px solid ${theme.vars.palette.divider}`,
  boxShadow: theme.shadows[6],
  pointerEvents: 'auto',
}));

const SaveSnippetToolbar = ({
  containerRef,
  onSaveKeywords,
  onSaveNotes,
}: SaveSnippetToolbarProps) => {
  const { t } = useTranslation();
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  // AC-50: detect text selection on assistant bubbles + crawled content via mouseup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseUp = (event: MouseEvent) => {
      // Ignore mouseup if user clicked inside the toolbar itself
      if (toolbarRef.current && toolbarRef.current.contains(event.target as Node)) {
        return;
      }
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? '';
      if (!text || !selection || selection.rangeCount === 0) {
        setPosition(null);
        return;
      }
      // Only react to selections originating inside the container
      const anchorNode = selection.anchorNode;
      if (!anchorNode || !container.contains(anchorNode)) {
        setPosition(null);
        return;
      }
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setPosition(null);
        return;
      }

      // Default: place toolbar ABOVE the selection. If no room, flip below.
      const aboveTop = rect.top - TOOLBAR_HEIGHT - TOOLBAR_OFFSET;
      const placeAbove = aboveTop > 8;
      const top = placeAbove ? aboveTop : rect.bottom + TOOLBAR_OFFSET;

      // Center horizontally on the selection, clamped to viewport (16px gutter)
      const centerX = rect.left + rect.width / 2;
      const left = Math.max(16, Math.min(window.innerWidth - 16, centerX));

      const sourceUrl = findSourceUrl(anchorNode);

      setPosition({ top, left, selectedText: text, sourceUrl });
    };

    const handleSelectionClear = () => {
      const selection = window.getSelection();
      if (!selection?.toString().trim()) {
        setPosition(null);
      }
    };

    container.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('selectionchange', handleSelectionClear);

    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectionchange', handleSelectionClear);
    };
  }, [containerRef]);

  // Hide toolbar when scrolling — selection bounds become stale
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !position) return;
    const handleScroll = () => setPosition(null);
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef, position]);

  if (!position) return null;

  const handleSaveKeywords = () => {
    onSaveKeywords(position.selectedText, position.sourceUrl);
    setPosition(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleSaveNotes = () => {
    onSaveNotes(position.selectedText, position.sourceUrl);
    setPosition(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <ToolbarRoot
      ref={toolbarRef}
      role="toolbar"
      aria-label={t('search.save.toolbarLabel')}
      sx={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
      // Prevent mousedown from collapsing the selection before click fires
      onMouseDown={(e) => e.preventDefault()}
    >
      <Stack direction="row" gap={0.5}>
        <Button
          size="small"
          variant="text"
          onClick={handleSaveKeywords}
          startIcon={<BookmarkBorderIcon sx={{ fontSize: 16 }} />}
          sx={{ textTransform: 'none', fontSize: '0.75rem', minHeight: 28 }}
        >
          {t('search.save.toKeywords')}
        </Button>
        <Button
          size="small"
          variant="text"
          onClick={handleSaveNotes}
          startIcon={<NoteAddOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{ textTransform: 'none', fontSize: '0.75rem', minHeight: 28 }}
        >
          {t('search.save.toNotes')}
        </Button>
      </Stack>
    </ToolbarRoot>
  );
};

export default SaveSnippetToolbar;
