import { useCallback, useState } from 'react';
import type {
  DragEndEvent,
  DragStartEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import type { ChatGroup, ChatSession } from '@/types/search';
import {
  useReorderChatGroupsMutation,
  useReorderChatsInGroupMutation,
  useMoveChatToGroupMutation,
} from '@/store/searchSlice';

/**
 * FIX-chat-bugfixes-and-grouping Item 7 — drag-and-drop wiring for the
 * sidebar's RecentChats panel.
 *
 * Three orthogonal drop modes are derived from the `data` payloads attached to
 * the dragged + drop-target items via dnd-kit's `data.current`:
 *
 *  1. `type: 'group'` over `type: 'group'`
 *     → reorder the group list (`reorderChatGroups`).
 *  2. `type: 'chat'` over `type: 'chat'` in the SAME group container
 *     → reorder chats within that group (`reorderChatsInGroup`).
 *  3. `type: 'chat'` over a different group container (chat target in another
 *     group, or a group-header / empty-section droppable)
 *     → move chat into the destination group (`moveChatToGroup`) and append.
 *
 * Optimistic patches live in the RTK Query mutation definitions themselves;
 * this hook is glue + classification only.
 */

export type DragKind = 'chat' | 'group';

/** Item-data shape attached to every draggable + droppable in the panel. */
export interface DnDItemData extends Record<string, unknown> {
  type: DragKind;
  /** For chats: the group id the row currently belongs to (`null` = Ungrouped). */
  containerId?: string | null;
  /** Cached order arrays so the hook doesn't need to re-derive from store. */
  groupOrderedIds?: string[];
  chatOrderedIdsInContainer?: string[];
}

export interface UseChatGroupDnDArgs {
  groups: ChatGroup[];
  sessions: ChatSession[];
}

export interface UseChatGroupDnDResult {
  activeId: UniqueIdentifier | null;
  activeKind: DragKind | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

const readItemData = (
  data: { current?: Record<string, unknown> } | undefined,
): DnDItemData | null => {
  const current = data?.current;
  if (!current || typeof current.type !== 'string') return null;
  if (current.type !== 'chat' && current.type !== 'group') return null;
  return current as DnDItemData;
};

export const useChatGroupDnD = ({
  groups,
  sessions,
}: UseChatGroupDnDArgs): UseChatGroupDnDResult => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [reorderGroups] = useReorderChatGroupsMutation();
  const [reorderChats] = useReorderChatsInGroupMutation();
  const [moveChat] = useMoveChatToGroupMutation();

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeKind, setActiveKind] = useState<DragKind | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = readItemData(event.active.data);
    setActiveId(event.active.id);
    setActiveKind(data?.type ?? null);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setActiveKind(null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setActiveKind(null);
      if (!over || active.id === over.id) return;

      const activeData = readItemData(active.data);
      const overData = readItemData(over.data);
      if (!activeData || !overData) return;

      try {
        // Branch 1: group ↔ group reorder.
        if (activeData.type === 'group' && overData.type === 'group') {
          const base =
            activeData.groupOrderedIds ?? groups.map((g) => g.id);
          const fromIdx = base.indexOf(String(active.id));
          const toIdx = base.indexOf(String(over.id));
          if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
          const next = arrayMove(base, fromIdx, toIdx);
          await reorderGroups({ ordered_ids: next }).unwrap();
          return;
        }

        // Branch 2 + 3: chat dragged.
        if (activeData.type === 'chat') {
          const sourceContainer = activeData.containerId ?? null;
          // Resolve the destination container by the over target's kind:
          //   - over chat row     → that row's container
          //   - over group entry  → the group itself (over.id IS the group id)
          //   - over droppable    → its data.containerId (group section body)
          // Earlier this branch collapsed all non-chat cases to
          // `overData.containerId ?? null`, which turned a drop on a group
          // header (containerId=null on the sortable group entry) into
          // "reorder in Ungrouped", making the chat appear to vanish to the
          // bottom of the list.
          let destContainer: string | null;
          if (overData.type === 'chat') {
            destContainer = overData.containerId ?? null;
          } else if (overData.type === 'group') {
            destContainer = String(over.id);
          } else {
            destContainer = overData.containerId ?? null;
          }

          // Same-container reorder.
          if (sourceContainer === destContainer) {
            const sameGroupIds =
              activeData.chatOrderedIdsInContainer ??
              sessions
                .filter((s) => (s.group ?? null) === sourceContainer)
                .map((s) => s.id);
            const fromIdx = sameGroupIds.indexOf(String(active.id));
            // Over a chat row → reorder to that position; over a container
            // (header / empty section) → append to end.
            const overChatIdx =
              overData.type === 'chat'
                ? sameGroupIds.indexOf(String(over.id))
                : sameGroupIds.length - 1;
            if (fromIdx < 0 || overChatIdx < 0 || fromIdx === overChatIdx) {
              return;
            }
            const next = arrayMove(sameGroupIds, fromIdx, overChatIdx);
            await reorderChats({
              groupId: sourceContainer,
              ordered_ids: next,
            }).unwrap();
            return;
          }

          // Cross-container move — append to destination (backend
          // auto-assigns group_ordering = max + 1).
          await moveChat({
            sessionId: String(active.id),
            groupId: destContainer,
          }).unwrap();
        }
      } catch {
        enqueueSnackbar(t('chatNicheRag.history.deleteFailed'), {
          variant: 'error',
        });
      }
    },
    [groups, sessions, reorderGroups, reorderChats, moveChat, enqueueSnackbar, t],
  );

  return {
    activeId,
    activeKind,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
};
