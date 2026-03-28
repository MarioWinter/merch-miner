import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import ShareIcon from '@mui/icons-material/Share';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setActiveSession,
  setSearching,
  openDrawer,
} from '@/store/chatBarSlice';
import {
  useGetSessionQuery,
  useCreateSessionMutation,
  useSendMessageMutation,
  useShareSessionMutation,
  useUnshareSessionMutation,
} from '@/store/searchSlice';
import { useSearchHealth } from '../hooks/useSearchHealth';
import type { ChatSession } from '@/types/search';
import ContextChip from './ContextChip';
import ChatControls from './ChatControls';
import ChatMessageList from './ChatMessageList';
import RecentChats from './RecentChats';
import SessionTagManager from './SessionTagManager';

const PanelRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
});

const InputArea = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: `${theme.spacing(1.5)} ${theme.spacing(2)}`,
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  flexShrink: 0,
}));

const ChatPanel = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const { activeSessionId, nicheContext, searching, searchMode, searchSources, selectedModel } =
    useAppSelector((s) => s.chatBar);
  const { vaneOnline } = useSearchHealth();

  const [message, setMessage] = useState('');
  const [showRecent, setShowRecent] = useState(!activeSessionId);
  const [showControls, setShowControls] = useState(false);

  const { data: session, isLoading: sessionLoading } = useGetSessionQuery(activeSessionId ?? '', {
    skip: !activeSessionId,
  });

  const [createSession] = useCreateSessionMutation();
  const [sendMessage] = useSendMessageMutation();
  const [shareSession] = useShareSessionMutation();
  const [unshareSession] = useUnshareSessionMutation();

  const messages = session?.messages ?? [];
  const isReadOnly = session?.is_shared && session?.shared_by !== null;

  const handleSend = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || searching || !vaneOnline) return;

    dispatch(setSearching(true));
    setMessage('');

    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        const newSession = await createSession({
          niche_context: nicheContext?.id,
          title: trimmed.slice(0, 100),
        }).unwrap();
        sessionId = newSession.id;
        dispatch(setActiveSession(sessionId));
        dispatch(openDrawer('search'));
      }

      await sendMessage({
        sessionId,
        body: {
          content: trimmed,
          search_mode: searchMode,
          search_sources: searchSources,
          model: selectedModel,
        },
      }).unwrap();
    } catch {
      enqueueSnackbar(t('search.chat.sendError'), { variant: 'error' });
    } finally {
      dispatch(setSearching(false));
    }
  }, [
    message, searching, vaneOnline, activeSessionId, nicheContext, searchMode,
    searchSources, selectedModel, dispatch, createSession, sendMessage, enqueueSnackbar, t,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectSession = (s: ChatSession) => {
    dispatch(setActiveSession(s.id));
    setShowRecent(false);
  };

  const handleShare = async () => {
    if (!activeSessionId) return;
    try {
      if (session?.is_shared) {
        await unshareSession(activeSessionId).unwrap();
        enqueueSnackbar(t('search.sessions.unshared'), { variant: 'success' });
      } else {
        await shareSession(activeSessionId).unwrap();
        enqueueSnackbar(t('search.sessions.shared'), { variant: 'success' });
      }
    } catch {
      enqueueSnackbar(t('search.sessions.shareError'), { variant: 'error' });
    }
  };

  return (
    <PanelRoot>
      {/* Header area */}
      <Stack gap={1} sx={{ px: 2, pt: 1.5, pb: 1, flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Button
            size="small"
            onClick={() => setShowRecent((v) => !v)}
            endIcon={showRecent ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ textTransform: 'none', fontSize: '0.8125rem', color: 'text.secondary' }}
          >
            {t('search.sessions.recentChats')}
          </Button>
          <Stack direction="row" gap={0.5}>
            {activeSessionId && (
              <IconButton size="small" onClick={handleShare} aria-label={t('search.sessions.share')}>
                {session?.is_shared ? (
                  <ShareIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                ) : (
                  <ShareOutlinedIcon sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            )}
            <IconButton
              size="small"
              onClick={() => setShowControls((v) => !v)}
              aria-label={t('search.chat.toggleControls')}
              sx={{ color: 'text.secondary' }}
            >
              {showControls ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Stack>
        </Stack>

        <ContextChip />

        {/* Tags for active session */}
        {session && activeSessionId && (
          <SessionTagManager
            sessionId={activeSessionId}
            currentTags={session.tags ?? []}
            readOnly={!!isReadOnly}
          />
        )}

        {/* Controls collapse */}
        <Collapse in={showControls}>
          <ChatControls />
        </Collapse>
      </Stack>

      <Divider />

      {/* Recent chats dropdown */}
      <Collapse in={showRecent}>
        <Box sx={{ maxHeight: 240, overflowY: 'auto', px: 1, py: 0.5 }}>
          <RecentChats onSelect={handleSelectSession} activeSessionId={activeSessionId} />
        </Box>
        <Divider />
      </Collapse>

      {/* Message list */}
      <ChatMessageList
        messages={messages}
        isLoading={sessionLoading}
        hasMore={messages.length >= 50}
        onLoadMore={() => {
          /* pagination handled by API offset — future enhancement */
        }}
      />

      {/* Input area */}
      {!isReadOnly && (
        <InputArea>
          <TextField
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              vaneOnline
                ? t('search.chatBar.placeholder')
                : t('search.health.vaneOffline')
            }
            variant="outlined"
            size="small"
            fullWidth
            disabled={!vaneOnline || searching}
            slotProps={{
              input: { sx: { fontSize: '0.8125rem', borderRadius: '20px' } },
            }}
          />
          <IconButton
            onClick={handleSend}
            disabled={!message.trim() || searching || !vaneOnline}
            color="primary"
            size="small"
            aria-label={t('search.chatBar.send')}
          >
            {searching ? <CircularProgress size={18} /> : <SendIcon sx={{ fontSize: 20 }} />}
          </IconButton>
        </InputArea>
      )}

      {isReadOnly && (
        <Box sx={{ px: 2, py: 1.5, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {t('search.sessions.readOnly')}
          </Typography>
        </Box>
      )}
    </PanelRoot>
  );
};

export default ChatPanel;
