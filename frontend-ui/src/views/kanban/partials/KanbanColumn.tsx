import { Box, Chip, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import type { NicheCard as NicheCardType, KanbanColumnId } from '../types';
import NicheCard from './NicheCard';
import EmptyColumn from './EmptyColumn';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const ColumnRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 240,
  maxWidth: 320,
  background: theme.vars.palette.background.default,
  borderRadius: 12,
  border: `1px solid ${theme.vars.palette.divider}`,
  overflow: 'hidden',
}));

interface ColumnHeaderProps {
  $color: string;
}

const ColumnHeader = styled(Box, {
  shouldForwardProp: (p) => p !== '$color',
})<ColumnHeaderProps>(({ theme, $color }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1.5, 2),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  background: alpha($color, 0.06),
}));

const CardList = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: theme.spacing(1),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  minHeight: 120,
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface KanbanColumnProps {
  id: KanbanColumnId;
  label: string;
  color: string;
  cards: NicheCardType[];
  onCardClick: (nicheId: string) => void;
}

const KanbanColumn = ({ id, label, color, cards, onCardClick }: KanbanColumnProps) => {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <ColumnRoot
      ref={setNodeRef}
      sx={{
        outline: isOver ? `2px solid ${color}` : 'none',
        transition: 'outline 150ms ease',
      }}
    >
      <ColumnHeader $color={color}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: color,
            }}
          />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t(label)}
          </Typography>
        </Box>
        <Chip
          label={cards.length}
          size="small"
          sx={{
            height: 20,
            minWidth: 28,
            fontSize: 11,
            fontWeight: 700,
          }}
        />
      </ColumnHeader>

      <CardList>
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.length === 0 ? (
            <EmptyColumn />
          ) : (
            cards.map((card) => (
              <NicheCard key={card.id} card={card} onClick={onCardClick} />
            ))
          )}
        </SortableContext>
      </CardList>
    </ColumnRoot>
  );
};

export default KanbanColumn;
