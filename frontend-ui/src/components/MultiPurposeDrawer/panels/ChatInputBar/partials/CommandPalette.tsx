/**
 * PROJ-20 Phase 3.5 — CommandPalette
 *
 * Floating-UI dropdown anchored to the caret rect inside SmartTextarea.
 * Mirrors `MentionPicker` (same anchoring strategy, same keyboard model)
 * but renders a list of `/command` rows instead of niche rows.
 *
 * Keyboard model is owned by `useCommandTrigger`. This component only
 * paints the active row (driven by `activeIndex`) and surfaces hover +
 * click events.
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
  List,
  ListItemButton,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { Command } from '../utils/commandRegistry';

export interface CommandPaletteProps {
  open: boolean;
  anchorRect: DOMRect | null;
  query: string;
  commands: Command[];
  activeIndex: number;
  onSelect: (cmd: Command) => void;
  onClose: () => void;
  onHoverIndex?: (index: number) => void;
}

const PaletteSurface = styled(Box)(({ theme }) => ({
  width: 340,
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
  alignItems: 'flex-start',
  backgroundColor: isActive
    ? alpha(theme.palette.primary.main, 0.12)
    : 'transparent',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.16),
  },
}));

const TriggerBadge = styled(Box)(({ theme }) => ({
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: '0.78rem',
  padding: theme.spacing(0.125, 0.75),
  borderRadius: 6,
  backgroundColor: alpha(theme.palette.primary.main, 0.18),
  color: theme.vars.palette.primary.main,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  lineHeight: 1.4,
}));

const EmptyState = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(2),
  textAlign: 'center',
}));

const CommandPalette = ({
  open,
  anchorRect,
  query,
  commands,
  activeIndex,
  onSelect,
  onClose,
  onHoverIndex,
}: CommandPaletteProps) => {
  const { t } = useTranslation();
  const activeRowRef = useRef<HTMLDivElement | null>(null);

  const virtualEl = useMemo(() => {
    if (!anchorRect) return null;
    return {
      getBoundingClientRect: () => anchorRect,
      contextElement: document.body,
    };
  }, [anchorRect]);

  const { refs, floatingStyles } = useFloating({
    open,
    placement: 'top-start',
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const { setFloating, setReference } = refs;

  useEffect(() => {
    if (virtualEl) {
      setReference(virtualEl);
    }
  }, [virtualEl, setReference]);

  useEffect(() => {
    if (!open) return;
    activeRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  if (!open) return null;

  const hasResults = commands.length > 0;

  return (
    <FloatingPortal>
      <PaletteSurface
        ref={setFloating}
        style={floatingStyles}
        role="listbox"
        aria-label={t('search.commands.ariaLabel')}
        data-testid="command-palette"
        onMouseDown={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        {hasResults ? (
          <List dense disablePadding>
            {commands.map((cmd, idx) => {
              const isActive = idx === activeIndex;
              return (
                <Row
                  key={cmd.name}
                  isActive={isActive}
                  ref={(el) => {
                    if (isActive) activeRowRef.current = el;
                  }}
                  selected={isActive}
                  onMouseEnter={() => onHoverIndex?.(idx)}
                  onClick={() => onSelect(cmd)}
                  role="option"
                  aria-selected={isActive}
                  data-testid={`command-palette-row-${idx}`}
                >
                  <TriggerBadge>{cmd.trigger}</TriggerBadge>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ fontWeight: 500, lineHeight: 1.3 }}
                    >
                      {t(cmd.descriptionKey)}
                    </Typography>
                  </Box>
                </Row>
              );
            })}
          </List>
        ) : (
          <EmptyState data-testid="command-palette-empty">
            <Typography variant="body2" color="text.secondary">
              {t('search.commands.empty', { query })}
            </Typography>
          </EmptyState>
        )}
      </PaletteSurface>
    </FloatingPortal>
  );
};

export default CommandPalette;
