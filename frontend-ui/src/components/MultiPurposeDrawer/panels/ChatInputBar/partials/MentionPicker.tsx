/**
 * PROJ-20 Phase 3.3 — Mention Picker
 *
 * Floating-UI dropdown anchored to the caret rect inside SmartTextarea.
 * Receives a virtual anchor (only `getBoundingClientRect`) so we don't need
 * a real DOM reference element to position against.
 *
 * Responsibilities:
 * - Render up to 8 niche rows (icon + name + slug)
 * - Active row highlight (keyboard nav handled by parent hook; we just paint)
 * - Empty / loading / no-niches states
 * - "+ Neue Nische erstellen" CTA when workspace has zero niches
 *
 * Positioning strategy (Floating UI middleware):
 * - `flip` — swap to opposite placement if no room
 * - `shift` — keep on screen along the cross-axis
 * - `offset` — small gap from the cursor rect
 */
import { useEffect, useMemo, useRef } from 'react';
import {
  useFloating,
  flip,
  shift,
  offset,
  autoUpdate,
  FloatingPortal,
} from '@floating-ui/react';
import {
  Box,
  CircularProgress,
  List,
  ListItemButton,
  Typography,
  Avatar,
  Button,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';

export interface MentionPickerNiche {
  id: string;
  name: string;
  slug?: string;
}

export interface MentionPickerProps {
  open: boolean;
  anchorRect: DOMRect | null;
  query: string;
  niches: MentionPickerNiche[];
  activeIndex: number;
  isLoading: boolean;
  onSelect: (niche: MentionPickerNiche) => void;
  onClose: () => void;
  onCreateNiche: () => void;
  onHoverIndex?: (index: number) => void;
}

const PickerSurface = styled(Box)(({ theme }) => ({
  width: 320,
  maxHeight: 360,
  overflowY: 'auto',
  borderRadius: 12,
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  boxShadow: theme.shadows[8],
  padding: theme.spacing(0.5),
  zIndex: theme.zIndex.tooltip + 1,
}));

const Row = styled(ListItemButton, {
  shouldForwardProp: (prop) => prop !== 'isActive',
})<{ isActive: boolean }>(({ theme, isActive }) => ({
  borderRadius: 8,
  padding: theme.spacing(0.75, 1),
  gap: theme.spacing(1),
  backgroundColor: isActive
    ? alpha(theme.palette.primary.main, 0.12)
    : 'transparent',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.16),
  },
}));

const RowAvatar = styled(Avatar)(({ theme }) => ({
  width: 28,
  height: 28,
  fontSize: '0.8rem',
  backgroundColor: alpha(theme.palette.primary.main, 0.18),
  color: theme.vars.palette.primary.main,
  fontWeight: 600,
}));

const EmptyState = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  textAlign: 'center',
}));

const initialsOf = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return trimmed.slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const MentionPicker = ({
  open,
  anchorRect,
  query,
  niches,
  activeIndex,
  isLoading,
  onSelect,
  onClose,
  onCreateNiche,
  onHoverIndex,
}: MentionPickerProps) => {
  const { t } = useTranslation();
  const activeRowRef = useRef<HTMLDivElement | null>(null);

  // Virtual anchor element. Floating-UI accepts an object with
  // `getBoundingClientRect`. We rebuild it whenever the rect changes.
  const virtualEl = useMemo(() => {
    if (!anchorRect) return null;
    return {
      getBoundingClientRect: () => anchorRect,
      // contextElement helps Floating-UI handle scroll containers correctly.
      contextElement: document.body,
    };
  }, [anchorRect]);

  const { refs, floatingStyles } = useFloating({
    open,
    placement: 'top-start',
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  // Extract setFloating outside JSX so the react-hooks/refs lint rule
  // doesn't flag the ref-assignment expression `ref={refs.setFloating}`.
  const { setFloating, setReference } = refs;

  // Wire the virtual anchor into Floating-UI whenever it changes.
  useEffect(() => {
    if (virtualEl) {
      setReference(virtualEl);
    }
  }, [virtualEl, setReference]);

  // Scroll the active row into view as the user navigates with arrow keys.
  useEffect(() => {
    if (!open) return;
    activeRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  if (!open) return null;

  const hasQuery = query.trim().length > 0;
  const hasResults = niches.length > 0;

  const handleSelect = (niche: MentionPickerNiche) => {
    onSelect(niche);
  };

  return (
    <FloatingPortal>
      <PickerSurface
        ref={setFloating}
        style={floatingStyles}
        role="listbox"
        aria-label={t('search.chatBar.mentionPicker.ariaLabel')}
        data-testid="mention-picker"
        // Prevent blur of the editor when clicking on the picker.
        onMouseDown={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        {isLoading ? (
          <EmptyState data-testid="mention-picker-loading">
            <CircularProgress size={20} />
            <Typography variant="caption" color="text.secondary">
              {t('search.chatBar.mentionPicker.loading')}
            </Typography>
          </EmptyState>
        ) : hasResults ? (
          <List dense disablePadding>
            {niches.map((niche, idx) => {
              const isActive = idx === activeIndex;
              return (
                <Row
                  key={niche.id}
                  isActive={isActive}
                  ref={(el) => {
                    if (isActive) activeRowRef.current = el;
                  }}
                  selected={isActive}
                  onMouseEnter={() => onHoverIndex?.(idx)}
                  onClick={() => handleSelect(niche)}
                  role="option"
                  aria-selected={isActive}
                  data-testid={`mention-picker-row-${idx}`}
                >
                  <RowAvatar>{initialsOf(niche.name)}</RowAvatar>
                  <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ fontWeight: 500, lineHeight: 1.3 }}
                    >
                      {niche.name}
                    </Typography>
                    {niche.slug ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ lineHeight: 1.2 }}
                      >
                        @{niche.slug}
                      </Typography>
                    ) : null}
                  </Box>
                </Row>
              );
            })}
          </List>
        ) : hasQuery ? (
          <EmptyState data-testid="mention-picker-empty">
            <Typography variant="body2" color="text.secondary">
              {t('search.chatBar.mentionPicker.empty', { query })}
            </Typography>
          </EmptyState>
        ) : (
          <EmptyState data-testid="mention-picker-no-niches">
            <Typography variant="body2" color="text.secondary">
              {t('search.chatBar.mentionPicker.noNiches')}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={onCreateNiche}
              data-testid="mention-picker-create-niche"
            >
              {t('search.chatBar.mentionPicker.createNiche')}
            </Button>
          </EmptyState>
        )}
      </PickerSurface>
    </FloatingPortal>
  );
};

export default MentionPicker;
