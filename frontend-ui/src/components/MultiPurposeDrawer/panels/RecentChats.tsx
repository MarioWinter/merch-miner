import { useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
// TagChipRow removed in PROJ-17 Phase 2 cleanup (ChatSession.tags M2M dropped).
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  useListSessionsQuery,
  useDeleteSessionMutation,
} from '@/store/searchSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setActiveSession } from '@/store/chatBarSlice';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { ChatSession } from '@/types/search';

interface RecentChatsProps {
  onSelect: (session: ChatSession) => void;
  activeSessionId: string | null;
}

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

const RecentChats = ({ onSelect, activeSessionId }: RecentChatsProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const activeWorkspaceId = useAppSelector((s) => s.workspace.activeWorkspaceId);
  const { data, isLoading } = useListSessionsQuery({ page_size: 10 });
  const [deleteSession, { isLoading: isDeleting }] = useDeleteSessionMutation();
  const [pendingDelete, setPendingDelete] = useState<ChatSession | null>(null);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const session = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteSession(session.id).unwrap();
      // If the deleted session is the active one, clear it + drop the
      // workspace-scoped localStorage pointer so a reload doesn't try to
      // resurrect a 404'd id.
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
      enqueueSnackbar(t('chatNicheRag.history.deleteFailed'), { variant: 'error' });
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ px: 1, py: 1 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={48} sx={{ mb: 0.5, borderRadius: 2 }} />
        ))}
      </Box>
    );
  }

  const sessions = data?.results ?? [];

  if (sessions.length === 0) {
    return (
      <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {t('search.empty.noSessions')}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <List dense disablePadding sx={{ px: 0.5, py: 0.5 }}>
        {sessions.map((session) => {
          const selected = session.id === activeSessionId;
          return (
            <SessionItem
              key={session.id}
              selected={selected}
              onClick={() => onSelect(session)}
            >
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
                        <ShareOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      </IconButton>
                    )}
                    <Tooltip title={t('chatNicheRag.history.delete')}>
                      <DeleteButton
                        className="RecentChats-deleteBtn"
                        size="small"
                        aria-label={t('chatNicheRag.history.delete')}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDelete(session);
                        }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </DeleteButton>
                    </Tooltip>
                  </Stack>
                }
                secondary={
                  <Stack gap={0.25} sx={{ mt: 0.25 }}>
                    <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                      {session.niche_context && (
                        <Chip
                          label={session.niche_context.name}
                          size="small"
                          variant="outlined"
                          color="secondary"
                          sx={{ fontSize: '0.6875rem', height: 18, '& .MuiChip-label': { px: 0.75 } }}
                        />
                      )}
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6875rem' }}>
                        {new Date(session.updated_at).toLocaleDateString()}
                      </Typography>
                    </Stack>
                    {/* Tags removed in PROJ-17 Phase 2 cleanup — ChatSession.tags M2M dropped. */}
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
          );
        })}
      </List>
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
