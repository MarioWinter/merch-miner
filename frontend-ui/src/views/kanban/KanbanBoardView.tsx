import { useState } from 'react';
import { Alert, Box, Skeleton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import ViewKanbanOutlinedIcon from '@mui/icons-material/ViewKanbanOutlined';
import { useTranslation } from 'react-i18next';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useBoardData } from './hooks/useBoardData';
import { useCardDrag } from './hooks/useCardDrag';
import { useCardModal } from './hooks/useCardModal';
import KanbanColumn from './partials/KanbanColumn';
import CardModal from './partials/CardModal';
import AssigneeFilter from './partials/AssigneeFilter';
import ArchivedToggle from './partials/ArchivedToggle';
import MobileKanbanTabs from './partials/MobileKanbanTabs';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const BoardHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(2),
  flexWrap: 'wrap',
  gap: theme.spacing(1),
}));

const ColumnsRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1.5),
  flex: 1,
  overflowX: 'auto',
  alignItems: 'stretch',
  minHeight: 'calc(100vh - 200px)',
  paddingBottom: theme.spacing(1),
}));

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

const BoardSkeleton = () => (
  <ColumnsRow>
    {[1, 2, 3, 4, 5].map((i) => (
      <Box key={i} sx={{ flex: 1, minWidth: 240, maxWidth: 320 }}>
        <Skeleton variant="rounded" height={40} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={100} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={100} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={100} />
      </Box>
    ))}
  </ColumnsRow>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const KanbanBoardView = () => {
  const { t } = useTranslation();
  const { isDesktop } = useResponsiveLayout();
  const [assigneeFilter, setAssigneeFilter] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { columns, isLoading, isError, showWarning, refetch } = useBoardData({
    assigneeFilter,
    showArchived,
  });

  const {
    activeCardId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useCardDrag();

  const { openCard } = useCardModal();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Find active card for drag overlay
  const activeCard = activeCardId
    ? columns.flatMap((c) => c.cards).find((c) => c.id === activeCardId)
    : null;

  return (
    <Box>
      {/* Page header */}
      <BoardHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ViewKanbanOutlinedIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {t('kanban.board.title')}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AssigneeFilter value={assigneeFilter} onChange={setAssigneeFilter} />
          <ArchivedToggle checked={showArchived} onChange={setShowArchived} />
        </Box>
      </BoardHeader>

      {/* Warning: 200+ niches */}
      {showWarning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('kanban.board.maxWarning')}
        </Alert>
      )}

      {/* Error state */}
      {isError && (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Box
            component="button"
            onClick={() => refetch()}
            sx={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {t('common.retry')}
          </Box>
        }>
          {t('kanban.board.loadError')}
        </Alert>
      )}

      {/* Board */}
      {isLoading ? (
        <BoardSkeleton />
      ) : isDesktop ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <ColumnsRow>
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                label={col.label}
                color={col.color}
                cards={col.cards}
                onCardClick={openCard}
              />
            ))}
          </ColumnsRow>

          {/* Drag overlay — renders a ghost card while dragging */}
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
                  maxWidth: 280,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {activeCard.name}
                </Typography>
              </Box>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        // PROJ-30 T3.21 — Mobile: one column visible at a time, tab-switched.
        // Cross-column moves use the per-card "Move to column…" menu.
        <MobileKanbanTabs columns={columns} onCardClick={openCard} />
      )}

      {/* Card Modal — deep-linked via ?card=nicheId */}
      <CardModal />
    </Box>
  );
};

export default KanbanBoardView;
