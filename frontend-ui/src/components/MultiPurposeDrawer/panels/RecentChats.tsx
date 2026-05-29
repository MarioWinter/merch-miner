import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  FormHelperText,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  useListSessionsQuery,
  useGetChatGroupsQuery,
  useDeleteSessionMutation,
  useCreateChatGroupMutation,
} from '@/store/searchSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setActiveSession } from '@/store/chatBarSlice';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { ChatSession } from '@/types/search';
import UngroupedSection from './RecentChats/UngroupedSection';
import GroupSection from './RecentChats/GroupSection';
import ChatDragOverlay from './RecentChats/ChatDragOverlay';
import { useGroupCollapseState } from './RecentChats/hooks/useGroupCollapseState';
import { useChatGroupDnD } from './RecentChats/hooks/useChatGroupDnD';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const HeaderRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(0.5, 1),
}));

const NewGroupButton = styled(Button)({
  textTransform: 'none',
  fontSize: '0.75rem',
  fontWeight: 600,
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RecentChatsProps {
  onSelect: (session: ChatSession) => void;
  activeSessionId: string | null;
  /** Optional slot rendered on the LEFT of the header row, opposite the
   *  "+ New group" button. Used by the parent drawer to colocate global
   *  actions (e.g. Clear all chats) so the two top-rows merge into one,
   *  saving vertical space. */
  headerLeftAction?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const RecentChats = ({
  onSelect,
  activeSessionId,
  headerLeftAction,
}: RecentChatsProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const activeWorkspaceId = useAppSelector(
    (s) => s.workspace.activeWorkspaceId,
  );

  const { data: sessionsData, isLoading: isLoadingSessions } =
    useListSessionsQuery({ page_size: 10 });
  const { data: groupsData, isLoading: isLoadingGroups } =
    useGetChatGroupsQuery();
  const [deleteSession, { isLoading: isDeleting }] = useDeleteSessionMutation();
  const [createGroup] = useCreateChatGroupMutation();

  const { isCollapsed, toggleCollapsed } =
    useGroupCollapseState(activeWorkspaceId);

  const [pendingDelete, setPendingDelete] = useState<ChatSession | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupError, setNewGroupError] = useState<string | null>(null);

  // ---- Derived data ----
  const groups = useMemo(
    () => [...(groupsData ?? [])].sort((a, b) => a.ordering - b.ordering),
    [groupsData],
  );
  const sessions = useMemo(
    () => sessionsData?.results ?? [],
    [sessionsData],
  );

  const ungroupedSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.group === null)
        .sort((a, b) => a.group_ordering - b.group_ordering),
    [sessions],
  );

  const sessionsByGroupId = useMemo(() => {
    const map = new Map<string, ChatSession[]>();
    for (const s of sessions) {
      if (!s.group) continue;
      const list = map.get(s.group) ?? [];
      list.push(s);
      map.set(s.group, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.group_ordering - b.group_ordering);
    }
    return map;
  }, [sessions]);

  const groupOrderedIds = useMemo(() => groups.map((g) => g.id), [groups]);

  // ---- DnD ----
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const dnd = useChatGroupDnD({ groups, sessions });

  // ---- Handlers ----
  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const session = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteSession(session.id).unwrap();
      if (activeSessionId === session.id) {
        dispatch(setActiveSession(null));
        if (activeWorkspaceId && typeof window !== 'undefined') {
          try {
            window.localStorage.removeItem(
              `mm-active-chat-session-${activeWorkspaceId}`,
            );
          } catch {
            /* quota / privacy — ignore */
          }
        }
      }
      enqueueSnackbar(t('chatNicheRag.history.deleted'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('chatNicheRag.history.deleteFailed'), {
        variant: 'error',
      });
    }
  };

  const handleStartCreateGroup = () => {
    setNewGroupName('');
    setNewGroupError(null);
    setIsCreatingGroup(true);
  };

  const handleCancelCreateGroup = () => {
    setIsCreatingGroup(false);
    setNewGroupName('');
    setNewGroupError(null);
  };

  const handleCommitCreateGroup = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      handleCancelCreateGroup();
      return;
    }
    try {
      await createGroup({ name: trimmed }).unwrap();
      setIsCreatingGroup(false);
      setNewGroupName('');
      setNewGroupError(null);
    } catch (err) {
      const apiErr = err as { data?: { code?: string } } | undefined;
      if (apiErr?.data?.code === 'chatgroup_duplicate_name') {
        setNewGroupError(t('chat.groups.duplicateName'));
      } else {
        enqueueSnackbar(t('chatNicheRag.history.deleteFailed'), {
          variant: 'error',
        });
        handleCancelCreateGroup();
      }
    }
  };

  // ---- Loading state ----
  const isLoading = isLoadingSessions || isLoadingGroups;
  if (isLoading) {
    return (
      <Box sx={{ px: 1, py: 1 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            height={48}
            sx={{ mb: 0.5, borderRadius: 2 }}
          />
        ))}
      </Box>
    );
  }

  // ---- Empty state ----
  if (sessions.length === 0 && groups.length === 0 && !isCreatingGroup) {
    return (
      <>
        <HeaderRow>
          <Box sx={{ flex: 1 }} />
          <NewGroupButton
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            onClick={handleStartCreateGroup}
          >
            {t('chat.groups.newGroup')}
          </NewGroupButton>
        </HeaderRow>
        <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('search.empty.noSessions')}
          </Typography>
        </Box>
      </>
    );
  }

  return (
    <>
      <HeaderRow>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          {headerLeftAction}
        </Box>
        <NewGroupButton
          size="small"
          startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          onClick={handleStartCreateGroup}
          aria-label={t('chat.groups.newGroup')}
        >
          {t('chat.groups.newGroup')}
        </NewGroupButton>
      </HeaderRow>

      {isCreatingGroup && (
        <Box sx={{ px: 1, py: 0.5 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={newGroupName}
            placeholder={t('chat.groups.newGroupPlaceholder')}
            onChange={(e) => {
              setNewGroupName(e.target.value);
              if (newGroupError) setNewGroupError(null);
            }}
            onBlur={() => {
              // Commit-on-blur unless the user is mid-fix on a duplicate error.
              if (!newGroupError) void handleCommitCreateGroup();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleCommitCreateGroup();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancelCreateGroup();
              }
            }}
            error={newGroupError !== null}
            slotProps={{
              htmlInput: {
                maxLength: 80,
                'aria-label': t('chat.groups.newGroup'),
              },
            }}
          />
          {newGroupError && (
            <FormHelperText error sx={{ ml: 1 }}>
              {newGroupError}
            </FormHelperText>
          )}
        </Box>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={dnd.handleDragStart}
        onDragEnd={dnd.handleDragEnd}
        onDragCancel={dnd.handleDragCancel}
      >
        <SortableContext
          items={groupOrderedIds}
          strategy={verticalListSortingStrategy}
        >
          {groups.map((group) => (
            <GroupSection
              key={group.id}
              group={group}
              sessions={sessionsByGroupId.get(group.id) ?? []}
              activeSessionId={activeSessionId}
              collapsed={isCollapsed(group.id)}
              onToggleCollapsed={() => toggleCollapsed(group.id)}
              onSelectSession={onSelect}
              onRequestDeleteSession={setPendingDelete}
              groupOrderedIds={groupOrderedIds}
            />
          ))}
        </SortableContext>

        <UngroupedSection
          sessions={ungroupedSessions}
          activeSessionId={activeSessionId}
          onSelectSession={onSelect}
          onRequestDeleteSession={setPendingDelete}
        />

        <ChatDragOverlay sessions={sessions} groups={groups} />
      </DndContext>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('chatNicheRag.history.deleteConfirm.title')}
        body={t('chatNicheRag.history.deleteConfirm.body')}
        confirmLabel={t('chatNicheRag.history.deleteConfirm.confirm')}
        cancelLabel={t('chatNicheRag.history.deleteConfirm.cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
        isLoading={isDeleting}
      />
    </>
  );
};

export default RecentChats;
