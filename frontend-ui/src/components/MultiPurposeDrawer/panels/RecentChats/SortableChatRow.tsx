import {
  Box,
  Chip,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useTranslation } from 'react-i18next';
import type { ChatSession } from '@/types/search';
import type { DnDItemData } from './hooks/useChatGroupDnD';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const SessionItem = styled(ListItemButton)(({ theme }) => ({
  position: 'relative',
  borderRadius: 8,
  padding: `${theme.spacing(1)} ${theme.spacing(1.25)} ${theme.spacing(1)} ${theme.spacing(1.5)}`,
  marginBottom: theme.spacing(0.5),
  alignItems: 'flex-start',
  gap: theme.spacing(1),
  transition: 'background-color 120ms ease',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.06),
  },
  '&:hover .RecentChats-deleteBtn': {
    opacity: 1,
    transform: 'translateY(0)',
  },
  '&:hover .RecentChats-dragHandle': {
    opacity: 1,
  },
  '&.Mui-selected': {
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: 6,
      bottom: 6,
      width: 3,
      borderRadius: '0 2px 2px 0',
      backgroundColor: theme.vars.palette.primary.main,
    },
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.14),
    },
  },
}));

const ChatIconBox = styled(ListItemIcon)(({ theme }) => ({
  minWidth: 0,
  marginTop: 2,
  color: theme.vars.palette.text.secondary,
}));

// Notion-style drag handle (6-dot grid). Sits at the leftmost edge of every
// chat row so the row's draggability is visually obvious. Faded by default,
// opaque on row-hover (CSS-driven by SessionItem above).
const DragHandle = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  marginLeft: -theme.spacing(0.5),
  marginRight: -theme.spacing(0.25),
  opacity: 0.35,
  transition: 'opacity 120ms ease',
  color: theme.vars.palette.text.disabled,
  cursor: 'grab',
  '&:active': {
    cursor: 'grabbing',
  },
}));

const DeleteButton = styled(IconButton)(({ theme }) => ({
  opacity: 0,
  transform: 'translateY(-2px)',
  transition: 'opacity 120ms ease, transform 120ms ease',
  color: theme.vars.palette.text.secondary,
  padding: 4,
  '&:hover': {
    color: theme.vars.palette.error.main,
    backgroundColor: alpha(theme.palette.error.main, 0.08),
  },
  '&:focus-visible': {
    opacity: 1,
    transform: 'translateY(0)',
  },
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SortableChatRowProps {
  session: ChatSession;
  selected: boolean;
  /** Group id this row currently lives in; `null` ⇒ Ungrouped section. */
  containerId: string | null;
  /** Ordered list of sibling chat ids in the same container (used by
   *  `useChatGroupDnD` to compute reorder indices). */
  orderedIdsInContainer: string[];
  onSelect: () => void;
  onRequestDelete: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SortableChatRow = ({
  session,
  selected,
  containerId,
  orderedIdsInContainer,
  onSelect,
  onRequestDelete,
}: SortableChatRowProps) => {
  const { t } = useTranslation();
  const data: DnDItemData = {
    type: 'chat',
    containerId,
    chatOrderedIdsInContainer: orderedIdsInContainer,
  };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: session.id, data });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    position: 'relative',
  };

  return (
    <Box ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SessionItem selected={selected} onClick={onSelect}>
        <DragHandle
          className="RecentChats-dragHandle"
          aria-hidden="true"
        >
          <DragIndicatorIcon sx={{ fontSize: 16 }} />
        </DragHandle>
        <ChatIconBox>
          <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
        </ChatIconBox>
        <ListItemText
          sx={{ my: 0 }}
          primary={
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Typography
                variant="body2"
                fontWeight={selected ? 600 : 500}
                noWrap
                sx={{ flex: 1, fontSize: '0.8125rem', lineHeight: 1.4 }}
              >
                {session.title || t('search.sessions.untitled')}
              </Typography>
              {session.is_shared && (
                <IconButton size="small" tabIndex={-1} sx={{ p: 0 }}>
                  <ShareOutlinedIcon
                    sx={{ fontSize: 14, color: 'text.secondary' }}
                  />
                </IconButton>
              )}
              <Tooltip title={t('chatNicheRag.history.delete')}>
                <DeleteButton
                  className="RecentChats-deleteBtn"
                  size="small"
                  aria-label={t('chatNicheRag.history.delete')}
                  onPointerDown={(e) => {
                    // Stop pointer-down from arming dnd-kit's drag — the user
                    // is targeting the delete affordance, not initiating a
                    // sort.
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestDelete();
                  }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </DeleteButton>
              </Tooltip>
            </Stack>
          }
          secondary={
            <Stack gap={0.25} sx={{ mt: 0.25 }}>
              <Stack
                direction="row"
                alignItems="center"
                gap={0.75}
                flexWrap="wrap"
              >
                {session.niche_context_name && (
                  <Chip
                    label={session.niche_context_name}
                    size="small"
                    variant="outlined"
                    color="secondary"
                    sx={{
                      fontSize: '0.6875rem',
                      height: 18,
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                )}
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ fontSize: '0.6875rem' }}
                >
                  {new Date(session.updated_at).toLocaleDateString()}
                </Typography>
              </Stack>
              {session.shared_by && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontStyle: 'italic', fontSize: '0.6875rem' }}
                >
                  {t('search.sessions.sharedBy', { name: session.shared_by })}
                </Typography>
              )}
            </Stack>
          }
          slotProps={{
            primary: { noWrap: true, component: 'div' },
            secondary: { component: 'div' },
          }}
        />
      </SessionItem>
    </Box>
  );
};

export default SortableChatRow;
