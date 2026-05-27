/**
 * PROJ-30 T3.20 — Mobile Kanban view.
 *
 * On <md viewports the horizontal-scrolling column layout becomes a
 * scrollable `<Tabs>` row (one tab per column). Each card in the active
 * tab keeps the existing dnd-kit `useSortable` for within-column reorder;
 * cross-column moves are handled via a "Move to column…" menu on the
 * card's 3-dot menu, which dispatches `updateNiche({ status })` — the
 * same RTK Query mutation used by `useCardDrag`.
 */
import { useState, type MouseEvent } from 'react';
import { Badge, Box, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tab, Tabs, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useUpdateNicheMutation } from '@/store/nicheSlice';
import NicheCard from './NicheCard';
import EmptyColumn from './EmptyColumn';
import { COLUMN_DROP_STATUS } from '../types';
import type { KanbanColumnId, NicheCard as NicheCardType } from '../types';

interface ColumnLite {
  id: KanbanColumnId;
  label: string;
  color: string;
  cards: NicheCardType[];
}

export interface MobileKanbanTabsProps {
  columns: ColumnLite[];
  onCardClick: (cardId: string) => void;
}

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Root = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
});

const TabBar = styled(Tabs)(({ theme }) => ({
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  minHeight: 44,
}));

const TabPanel = styled(Box)(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  padding: theme.spacing(1),
}));

const CardRow = styled(Box)({
  position: 'relative',
});

const CardMenuButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(0.5),
  right: theme.spacing(0.5),
  width: 44,
  height: 44,
  zIndex: 1,
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MobileKanbanTabs = ({ columns, onCardClick }: MobileKanbanTabsProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [updateNiche] = useUpdateNicheMutation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  // 3-dot menu (per-card)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuCardId, setMenuCardId] = useState<string | null>(null);
  const [moveAnchor, setMoveAnchor] = useState<HTMLElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const activeColumn: ColumnLite | undefined = columns[activeIndex];
  const activeCard = activeCardId
    ? columns.flatMap((c) => c.cards).find((c) => c.id === activeCardId) ?? null
    : null;

  const handleTabChange = (_event: unknown, newValue: number) => {
    setActiveIndex(newValue);
  };

  const handleMenuOpen = (event: MouseEvent<HTMLButtonElement>, cardId: string) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuCardId(cardId);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuCardId(null);
    setMoveAnchor(null);
  };

  const handleMoveOpen = (event: MouseEvent<HTMLLIElement>) => {
    setMoveAnchor(event.currentTarget);
  };

  const handleMove = async (targetColumnId: KanbanColumnId) => {
    if (!menuCardId) return;
    const newStatus = COLUMN_DROP_STATUS[targetColumnId];
    const cardId = menuCardId;
    handleMenuClose();
    try {
      await updateNiche({ id: cardId, body: { status: newStatus } }).unwrap();
    } catch {
      enqueueSnackbar(t('kanban.board.dragError'), { variant: 'error' });
    }
  };

  // -- dnd within visible column --
  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCardId(null);
    // Note: cross-column drag is intentionally not supported on mobile
    // (only one column is visible). Reorder is purely visual via dnd-kit
    // `SortableContext`; no PATCH is sent because position is not server-
    // tracked at this layer.
    void event;
  };

  const handleDragCancel = () => {
    setActiveCardId(null);
  };

  return (
    <Root>
      <TabBar
        value={activeIndex}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={t('kanban.board.title')}
      >
        {columns.map((col) => (
          <Tab
            key={col.id}
            label={
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
                  {t(col.label)}
                </Typography>
                <Badge
                  badgeContent={col.cards.length}
                  color="primary"
                  showZero
                  sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none' } }}
                />
              </Box>
            }
          />
        ))}
      </TabBar>

      <TabPanel role="tabpanel">
        {!activeColumn || activeColumn.cards.length === 0 ? (
          <EmptyColumn />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={activeColumn.cards.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {activeColumn.cards.map((card) => (
                <CardRow key={card.id}>
                  <NicheCard card={card} onClick={onCardClick} />
                  <CardMenuButton
                    aria-label={t('responsive.cardList.actionsAria', { title: card.name })}
                    onClick={(e) => handleMenuOpen(e, card.id)}
                  >
                    <MoreVertIcon sx={{ fontSize: 20 }} />
                  </CardMenuButton>
                </CardRow>
              ))}
            </SortableContext>

            <DragOverlay>
              {activeCard ? (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: 3,
                    opacity: 0.85,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {activeCard.name}
                  </Typography>
                </Box>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </TabPanel>

      {/* Per-card 3-dot menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMoveOpen}>
          <ListItemText>
            {t('responsive.kanban.moveToColumn', 'Move to column…')}
          </ListItemText>
        </MenuItem>
      </Menu>

      {/* Submenu — list of other columns */}
      <Menu
        anchorEl={moveAnchor}
        open={Boolean(moveAnchor)}
        onClose={handleMenuClose}
      >
        {columns
          .filter((col) => col.id !== activeColumn?.id)
          .map((col) => (
            <MenuItem key={col.id} onClick={() => handleMove(col.id)}>
              <ListItemIcon>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: col.color,
                  }}
                />
              </ListItemIcon>
              <ListItemText>{t(col.label)}</ListItemText>
            </MenuItem>
          ))}
      </Menu>
    </Root>
  );
};

export default MobileKanbanTabs;
