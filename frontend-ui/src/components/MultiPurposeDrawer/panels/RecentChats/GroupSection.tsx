import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Collapse,
  FormHelperText,
  IconButton,
  List,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import type { ChatGroup, ChatSession } from '@/types/search';
import {
  useRenameChatGroupMutation,
  useDeleteChatGroupMutation,
} from '@/store/searchSlice';
import ConfirmDialog from '@/components/ConfirmDialog';
import SortableChatRow from './SortableChatRow';
import type { DnDItemData } from './hooks/useChatGroupDnD';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const SectionHeader = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.5, 1),
  borderRadius: 6,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
  },
  '&:hover .RecentChats-groupKebab': {
    opacity: 1,
  },
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  flex: 1,
  fontSize: '0.75rem',
  fontWeight: 600,
  color: theme.vars.palette.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));

const CountBadge = styled(Typography)(({ theme }) => ({
  fontSize: '0.6875rem',
  color: theme.vars.palette.text.disabled,
  paddingLeft: theme.spacing(0.5),
}));

const KebabButton = styled(IconButton)({
  opacity: 0,
  padding: 2,
  transition: 'opacity 120ms ease',
  '&:focus-visible': { opacity: 1 },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GroupSectionProps {
  group: ChatGroup;
  sessions: ChatSession[];
  activeSessionId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelectSession: (session: ChatSession) => void;
  onRequestDeleteSession: (session: ChatSession) => void;
  /** Cached group-ordered ids so the sortable handlers don't re-derive. */
  groupOrderedIds: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const GroupSection = ({
  group,
  sessions,
  activeSessionId,
  collapsed,
  onToggleCollapsed,
  onSelectSession,
  onRequestDeleteSession,
  groupOrderedIds,
}: GroupSectionProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [renameGroup] = useRenameChatGroupMutation();
  const [deleteGroup] = useDeleteChatGroupMutation();

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(group.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Sortable item for the group itself (header is the drag handle). The
  // parent panel wraps all GroupSections in a SortableContext over the
  // group ids; this hook registers the group with the right `data.type`.
  const groupData: DnDItemData = {
    type: 'group',
    containerId: null,
    groupOrderedIds,
  };
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id, data: groupData });

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    position: 'relative',
  };

  // Droppable on the section body so an empty group can still accept a chat
  // drop. Uses a distinct id (prefixed) so dnd-kit doesn't confuse it with
  // the sortable group entry above.
  const chatDropData: DnDItemData = {
    type: 'chat',
    containerId: group.id,
  };
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `group-droppable-${group.id}`,
    data: chatDropData,
  });

  useEffect(() => {
    if (isRenaming) {
      // Defer focus to next tick so the TextField is mounted.
      setTimeout(() => renameInputRef.current?.focus(), 0);
    }
  }, [isRenaming]);

  const handleHeaderClick = () => {
    if (isRenaming) return;
    onToggleCollapsed();
  };

  const handleOpenMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  };

  const handleCloseMenu = () => setMenuAnchor(null);

  const startRename = () => {
    setRenameValue(group.name);
    setRenameError(null);
    setIsRenaming(true);
    handleCloseMenu();
  };

  const commitRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setIsRenaming(false);
      return;
    }
    if (trimmed === group.name) {
      setIsRenaming(false);
      return;
    }
    try {
      await renameGroup({ id: group.id, name: trimmed }).unwrap();
      setIsRenaming(false);
    } catch (err) {
      const apiErr = err as { data?: { code?: string } } | undefined;
      if (apiErr?.data?.code === 'chatgroup_duplicate_name') {
        setRenameError(t('chat.groups.duplicateName'));
      } else {
        enqueueSnackbar(t('chatNicheRag.history.deleteFailed'), {
          variant: 'error',
        });
        setIsRenaming(false);
      }
    }
  };

  const cancelRename = () => {
    setRenameValue(group.name);
    setRenameError(null);
    setIsRenaming(false);
  };

  const openDeleteConfirm = () => {
    setConfirmDeleteOpen(true);
    handleCloseMenu();
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteGroup({ id: group.id }).unwrap();
      setConfirmDeleteOpen(false);
    } catch {
      enqueueSnackbar(t('chatNicheRag.history.deleteFailed'), {
        variant: 'error',
      });
      setConfirmDeleteOpen(false);
    }
  };

  const sessionIds = sessions.map((s) => s.id);

  return (
    <Box
      ref={setSortableRef}
      style={sortableStyle}
      sx={{ mb: 0.5 }}
      data-testid={`group-section-${group.id}`}
    >
      <SectionHeader
        onClick={handleHeaderClick}
        {...attributes}
        {...listeners}
      >
        {collapsed ? (
          <KeyboardArrowRightIcon
            sx={{ fontSize: 16, color: 'text.secondary' }}
            aria-hidden
          />
        ) : (
          <KeyboardArrowDownIcon
            sx={{ fontSize: 16, color: 'text.secondary' }}
            aria-hidden
          />
        )}
        {isRenaming ? (
          <Box
            sx={{ flex: 1 }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <TextField
              inputRef={renameInputRef}
              value={renameValue}
              onChange={(e) => {
                setRenameValue(e.target.value);
                if (renameError) setRenameError(null);
              }}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void commitRename();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelRename();
                }
              }}
              size="small"
              fullWidth
              error={renameError !== null}
              slotProps={{
                htmlInput: {
                  'aria-label': t('chat.groups.rename'),
                  maxLength: 80,
                  style: { fontSize: '0.8125rem', padding: '2px 6px' },
                },
              }}
            />
            {renameError && (
              <FormHelperText error sx={{ mt: 0.25 }}>
                {renameError}
              </FormHelperText>
            )}
          </Box>
        ) : (
          <>
            <SectionLabel>{group.name}</SectionLabel>
            <CountBadge>{group.session_count}</CountBadge>
            <Tooltip title={t('chat.groups.rename')}>
              <KebabButton
                className="RecentChats-groupKebab"
                size="small"
                onClick={handleOpenMenu}
                aria-label={t('chat.groups.rename')}
              >
                <MoreVertIcon sx={{ fontSize: 16 }} />
              </KebabButton>
            </Tooltip>
          </>
        )}
      </SectionHeader>

      <Menu
        anchorEl={menuAnchor}
        open={menuAnchor !== null}
        onClose={handleCloseMenu}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={startRename}>{t('chat.groups.rename')}</MenuItem>
        <MenuItem onClick={openDeleteConfirm}>{t('chat.groups.delete')}</MenuItem>
      </Menu>

      <Collapse in={!collapsed} timeout="auto" unmountOnExit>
        <Box ref={setDroppableRef} sx={{ minHeight: 4 }}>
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
                  containerId={group.id}
                  orderedIdsInContainer={sessionIds}
                  onSelect={() => onSelectSession(session)}
                  onRequestDelete={() => onRequestDeleteSession(session)}
                />
              ))}
            </List>
          </SortableContext>
        </Box>
      </Collapse>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={t('chat.groups.deleteConfirmTitle', { name: group.name })}
        body={t('chat.groups.deleteConfirmBody', { count: group.session_count })}
        confirmLabel={t('chat.groups.delete')}
        cancelLabel={t('chat.groups.cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </Box>
  );
};

export default GroupSection;
