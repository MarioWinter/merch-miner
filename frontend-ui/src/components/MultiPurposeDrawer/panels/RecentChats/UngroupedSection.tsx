import { Box, List, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import type { ChatSession } from '@/types/search';
import SortableChatRow from './SortableChatRow';
import type { DnDItemData } from './hooks/useChatGroupDnD';

const SectionHeader = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.5, 1),
  borderRadius: 6,
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  flex: 1,
  fontSize: '0.75rem',
  fontWeight: 600,
  color: theme.vars.palette.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}));

const CountBadge = styled(Typography)(({ theme }) => ({
  fontSize: '0.6875rem',
  color: theme.vars.palette.text.disabled,
  paddingLeft: theme.spacing(0.5),
}));

export interface UngroupedSectionProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  onRequestDeleteSession: (session: ChatSession) => void;
}

const UngroupedSection = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onRequestDeleteSession,
}: UngroupedSectionProps) => {
  const { t } = useTranslation();

  // Droppable wrapper around the body so dropping on an empty Ungrouped
  // section still moves the chat into `group=null`.
  const dropData: DnDItemData = { type: 'chat', containerId: null };
  const { setNodeRef } = useDroppable({
    id: 'group-droppable-ungrouped',
    data: dropData,
  });

  const sessionIds = sessions.map((s) => s.id);

  return (
    <Box sx={{ mb: 0.5 }} data-testid="ungrouped-section">
      <SectionHeader>
        <SectionLabel>{t('chat.groups.ungrouped')}</SectionLabel>
        <CountBadge component="span">{sessions.length}</CountBadge>
      </SectionHeader>
      <Box ref={setNodeRef} sx={{ minHeight: 4 }}>
        <SortableContext
          items={sessionIds}
          strategy={verticalListSortingStrategy}
        >
          <List dense disablePadding sx={{ px: 0.5, py: 0.5 }}>
            {sessions.map((session) => (
              <SortableChatRow
                key={session.id}
                session={session}
                selected={session.id === activeSessionId}
                containerId={null}
                orderedIdsInContainer={sessionIds}
                onSelect={() => onSelectSession(session)}
                onRequestDelete={() => onRequestDeleteSession(session)}
              />
            ))}
          </List>
        </SortableContext>
      </Box>
    </Box>
  );
};

export default UngroupedSection;
