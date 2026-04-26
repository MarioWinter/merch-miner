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
import HistoryIcon from '@mui/icons-material/History';
import TuneIcon from '@mui/icons-material/Tune';
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
  useSaveSnippetToNicheMutation,
} from '@/store/searchSlice';
import { useSearchHealth } from '../hooks/useSearchHealth';
import { useSendMessageStream } from '@/hooks/useSendMessageStream';
import type {
  ChatSession,
  SaveSnippetKeywordsResponse,
  SaveSnippetNotesResponse,
} from '@/types/search';
import ContextChip from './ContextChip';
import ChatControls from './ChatControls';
import ChatMessageList from './ChatMessageList';
import RecentChats from './RecentChats';
import ModeDropdown from './ModeDropdown';
import SaveToNicheModal from './SaveToNicheModal';

interface ModalState {
  open: boolean;
  selectedText: string;
  saveAs: 'keywords' | 'notes';
  sourceUrl?: string;
}

const INITIAL_MODAL: ModalState = {
  open: false,
  selectedText: '',
  saveAs: 'keywords',
  sourceUrl: undefined,
};

const PanelRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
});

const InputArea = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  padding: `${theme.spacing(1.25)} ${theme.spacing(1.5)}`,
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: theme.vars.palette.background.paper,
  flexShrink: 0,
}));

const ChatPanel = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const { activeSessionId, nicheContext, searching, searchMode, searchSources, selectedModel, modeOverride } =
    useAppSelector((s) => s.chatBar);
  const { vaneOnline } = useSearchHealth();

  const [message, setMessage] = useState('');
  const [showRecent, setShowRecent] = useState(!activeSessionId);
  const [showControls, setShowControls] = useState(false);
  const [modal, setModal] = useState<ModalState>(INITIAL_MODAL);

  const { data: session, isLoading: sessionLoading } = useGetSessionQuery(activeSessionId ?? '', {
    skip: !activeSessionId,
  });

  const [createSession] = useCreateSessionMutation();
  const [sendMessage] = useSendMessageMutation();
  const [shareSession] = useShareSessionMutation();
  const [unshareSession] = useUnshareSessionMutation();
  const [saveSnippet] = useSaveSnippetToNicheMutation();
  const { start: startStream } = useSendMessageStream({
    sessionId: activeSessionId,
    onDone: () => dispatch(setSearching(false)),
  });

  const messages = session?.messages ?? [];
  const isReadOnly = session?.is_shared && session?.shared_by !== null;
  const isStreaming = useAppSelector(
    (s) => s.chatBar.streamingAssistantMessage.isStreaming,
  );

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
        dispatch(openDrawer('chat'));
      }

      // PROJ-17 Phase 4 Step 6: Agent → classic POST. Auto/Web → SSE stream.
      // EC-7: starting a new stream auto-cancels any active stream.
      if (modeOverride === 'agent') {
        await sendMessage({
          sessionId,
          body: {
            content: trimmed,
            search_mode: searchMode,
            search_sources: searchSources,
            model: selectedModel,
            mode_override: modeOverride,
          },
        }).unwrap();
        dispatch(setSearching(false));
      } else {
        startStream({
          content: trimmed,
          mode_override: modeOverride,
          niche_id: nicheContext?.id ?? null,
          sessionIdOverride: sessionId,
        });
        // searching cleared by useSendMessageStream onDone callback
      }
    } catch {
      enqueueSnackbar(t('search.chat.sendError'), { variant: 'error' });
      dispatch(setSearching(false));
    }
  }, [
    message, searching, vaneOnline, activeSessionId, nicheContext, searchMode,
    searchSources, selectedModel, modeOverride, dispatch, createSession,
    sendMessage, startStream, enqueueSnackbar, t,
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

  // AC-50–53: Save selected text either directly (when niche context active)
  // or via SaveToNicheModal (when no context — user picks niche).
  const handleSaveSelection = useCallback(
    async (saveAs: 'keywords' | 'notes', selectedText: string, sourceUrl?: string) => {
      const trimmed = selectedText.trim();
      if (!trimmed) return;

      // No active niche context → open picker modal
      if (!nicheContext) {
        setModal({ open: true, selectedText: trimmed, saveAs, sourceUrl });
        return;
      }

      // Active niche context → save directly
      try {
        const result = await saveSnippet({
          nicheId: nicheContext.id,
          body: {
            selected_text: trimmed,
            save_as: saveAs,
            ...(sourceUrl ? { source_url: sourceUrl } : {}),
          },
        }).unwrap();

        if (saveAs === 'keywords') {
          const kw = result as SaveSnippetKeywordsResponse;
          if (kw.created > 0) {
            enqueueSnackbar(
              t('search.save.successKeywords', { count: kw.created }),
              { variant: 'success' },
            );
          } else {
            enqueueSnackbar(t('search.save.allDuplicates'), { variant: 'info' });
          }
        } else {
          // notes
          const _note = result as SaveSnippetNotesResponse;
          void _note;
          enqueueSnackbar(t('search.save.successNote'), { variant: 'success' });
        }
      } catch {
        enqueueSnackbar(t('search.save.errorGeneric'), { variant: 'error' });
      }
    },
    [nicheContext, saveSnippet, enqueueSnackbar, t],
  );

  const handleSaveSelectionAsKeywords = useCallback(
    (text: string, sourceUrl?: string) => handleSaveSelection('keywords', text, sourceUrl),
    [handleSaveSelection],
  );

  const handleSaveSelectionAsNotes = useCallback(
    (text: string, sourceUrl?: string) => handleSaveSelection('notes', text, sourceUrl),
    [handleSaveSelection],
  );

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
      <Stack gap={1} sx={{ px: 2, pt: 1.25, pb: 1, flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Button
            size="small"
            onClick={() => setShowRecent((v) => !v)}
            startIcon={<HistoryIcon sx={{ fontSize: 16 }} />}
            endIcon={showRecent ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: 'text.secondary',
              height: 32,
              px: 1,
              minWidth: 0,
            }}
          >
            {t('search.sessions.recentChats')}
          </Button>
          <Stack direction="row" gap={0.25}>
            {activeSessionId && (
              <IconButton
                size="small"
                onClick={handleShare}
                aria-label={t('search.sessions.share')}
                sx={{ borderRadius: 1.5 }}
              >
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
              sx={{ color: 'text.secondary', borderRadius: 1.5 }}
            >
              <TuneIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        </Stack>

        <ContextChip />

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
        onSaveSelectionAsKeywords={handleSaveSelectionAsKeywords}
        onSaveSelectionAsNotes={handleSaveSelectionAsNotes}
      />

      {/* Input area */}
      {!isReadOnly && (
        <InputArea>
          <ModeDropdown compact />
          <TextField
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !vaneOnline
                ? t('search.health.vaneOffline')
                : isStreaming
                  ? t('search.stream.streaming')
                  : t('search.chatBar.placeholder')
            }
            variant="outlined"
            size="small"
            fullWidth
            disabled={!vaneOnline || searching || isStreaming}
            slotProps={{
              input: { sx: { fontSize: '0.8125rem', borderRadius: '20px' } },
            }}
          />
          <IconButton
            onClick={handleSend}
            disabled={!message.trim() || searching || isStreaming || !vaneOnline}
            color="primary"
            size="small"
            aria-label={t('search.chatBar.send')}
          >
            {searching || isStreaming ? <CircularProgress size={18} /> : <SendIcon sx={{ fontSize: 20 }} />}
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

      <SaveToNicheModal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        selectedText={modal.selectedText}
        saveAs={modal.saveAs}
        sourceUrl={modal.sourceUrl}
      />
    </PanelRoot>
  );
};

export default ChatPanel;
