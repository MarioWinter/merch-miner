import { Box, Avatar, Chip, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store/hooks';
import type { NicheCard as NicheCardType } from '../types';

// ---------------------------------------------------------------------------
// Status chip color mapping
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  data_entry: '#38BDF8',
  deep_research: '#38BDF8',
  niche_with_potential: '#38BDF8',
  to_designer: '#00C8D7',
  upload: '#F59E0B',
  start_ads: '#F59E0B',
  pending: '#22D3A3',
  winner: '#22D3A3',
  loser: '#FF5A4F',
  archived: '#7BAAB8',
};

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const CardRoot = styled(Box)(({ theme }) => ({
  background: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(1.5),
  cursor: 'grab',
  transition: 'box-shadow 150ms ease, transform 150ms ease',
  '&:hover': {
    boxShadow: `0 4px 16px ${alpha(theme.palette.common.black, 0.3)}`,
    transform: 'translateY(-1px)',
  },
}));

const CountRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 6,
});

const CountItem = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NicheCardProps {
  card: NicheCardType;
  onClick: (id: string) => void;
}

const NicheCard = ({ card, onClick }: NicheCardProps) => {
  const { t } = useTranslation();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { status: card.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Resolve assignee name from workspace members
  const activeWsId = useAppSelector((s) => s.workspace.activeWorkspaceId);
  const workspace = useAppSelector((s) =>
    s.workspace.workspaces.find((w) => w.id === activeWsId),
  );
  const assignee = workspace?.members.find((m) => m.id === card.assigned_to);

  const statusColor = STATUS_COLORS[card.status] ?? '#7BAAB8';

  return (
    <CardRoot
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(card.id)}
      role="button"
      tabIndex={0}
      aria-label={`${card.name} — ${card.status}`}
    >
      {/* Header row: thumbnail + name + round badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1,
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ImageOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {card.name}
          </Typography>
        </Box>

        {card.current_round > 1 && (
          <Chip
            label={`R${card.current_round}`}
            size="small"
            sx={{
              height: 20,
              fontSize: 11,
              fontWeight: 700,
              bgcolor: 'primary.main',
              color: '#fff',
            }}
          />
        )}
      </Box>

      {/* Status chip + assignee avatar row */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
        <Chip
          label={t(`kanban.card.status.${card.status}`)}
          size="small"
          sx={{
            height: 20,
            fontSize: 11,
            fontWeight: 600,
            bgcolor: alpha(statusColor, 0.15),
            color: statusColor,
          }}
        />
        {assignee && (
          <Avatar
            src={assignee.avatar_url ?? undefined}
            sx={{ width: 24, height: 24, fontSize: 11 }}
            aria-label={`${assignee.first_name} ${assignee.last_name}`.trim()}
          >
            {assignee.first_name?.charAt(0) || assignee.email.charAt(0)}
          </Avatar>
        )}
      </Box>

      {/* Counts row */}
      <CountRow>
        <CountItem>
          <LightbulbOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            {card.idea_count}
          </Typography>
        </CountItem>
        <CountItem>
          <BrushOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            {card.design_count ?? 0}
          </Typography>
        </CountItem>
        <CountItem>
          <ArticleOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            {card.listing_count ?? 0}
          </Typography>
        </CountItem>
      </CountRow>
    </CardRoot>
  );
};

export default NicheCard;
