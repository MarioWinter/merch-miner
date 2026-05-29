import { Box, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { DragOverlay, useDndContext } from '@dnd-kit/core';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import type { ChatGroup, ChatSession } from '@/types/search';

/**
 * FIX-chat-bugfixes-and-grouping Item 7 — `<DragOverlay>` ghost preview
 * for the active drag in the RecentChats panel. Without an overlay the
 * dragged element stays in place visually (dnd-kit renders the original at
 * 40% opacity via `SortableChatRow`'s isDragging style); the overlay
 * provides the cursor-following preview users expect.
 */

const GhostCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1, 1.25),
  borderRadius: 8,
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  maxWidth: 280,
  opacity: 0.95,
  pointerEvents: 'none',
}));

export interface ChatDragOverlayProps {
  sessions: ChatSession[];
  groups: ChatGroup[];
}

const ChatDragOverlay = ({ sessions, groups }: ChatDragOverlayProps) => {
  const { active } = useDndContext();
  const activeId = active?.id ?? null;
  const activeType = active?.data.current?.type as string | undefined;

  let body: React.ReactNode = null;
  if (activeId !== null) {
    if (activeType === 'chat') {
      const session = sessions.find((s) => s.id === activeId);
      if (session) {
        body = (
          <GhostCard data-testid="chat-drag-overlay-chat">
            <Stack direction="row" gap={1} alignItems="center">
              <ChatBubbleOutlineIcon
                sx={{ fontSize: 16, color: 'text.secondary' }}
              />
              <Typography
                variant="body2"
                fontWeight={500}
                noWrap
                sx={{ fontSize: '0.8125rem', lineHeight: 1.4 }}
              >
                {session.title}
              </Typography>
            </Stack>
          </GhostCard>
        );
      }
    } else if (activeType === 'group') {
      const group = groups.find((g) => g.id === activeId);
      if (group) {
        body = (
          <GhostCard data-testid="chat-drag-overlay-group">
            <Stack direction="row" gap={1} alignItems="center">
              <FolderOutlinedIcon
                sx={{ fontSize: 16, color: 'text.secondary' }}
              />
              <Typography
                variant="body2"
                fontWeight={600}
                noWrap
                sx={{ fontSize: '0.8125rem', lineHeight: 1.4 }}
              >
                {group.name}
              </Typography>
            </Stack>
          </GhostCard>
        );
      }
    }
  }

  return <DragOverlay dropAnimation={null}>{body}</DragOverlay>;
};

export default ChatDragOverlay;
