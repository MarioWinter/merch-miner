import { useCallback, useRef, useState } from 'react';
import {
  Box,
  Button,
  Collapse,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import ShareIcon from '@mui/icons-material/Share';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setActiveSession,
  setSearching,
  openDrawer,
} from '@/store/chatBarSlice';
import { clearAttachments } from '@/store/attachmentsSlice';
import {
  useGetSessionQuery,
  useCreateSessionMutation,
  useSendMessageMutation,
  useShareSessionMutation,
  useUnshareSessionMutation,
  useSaveSnippetToNicheMutation,
  useDeleteMessageMutation,
} from '@/store/searchSlice';
import { useSearchHealth } from '../hooks/useSearchHealth';
import { useSendMessageStream } from '@/hooks/useSendMessageStream';
import type {
  ChatMessage,
  ChatSession,
  SaveSnippetKeywordsResponse,
  SaveSnippetNotesResponse,
} from '@/types/search';
import ChatInputBar, {
  type ChatInputBarHandle,
  type ChatInputBarSubmitPayload,
} from './ChatInputBar';
import ChatMessageList from './ChatMessageList';
import RecentChats from './RecentChats';
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

// PROJ-20 Phase 3.7 — input area no longer needs the legacy TextField+Send
// row. ChatInputBar is the entire input surface; the wrapper just adds
// vertical padding above the message list separator.
const InputArea = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1, 1.5, 1.25),
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: theme.vars.palette.background.paper,
  flexShrink: 0,
}));

const ChatPanel = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const {
    activeSessionId,
    searching,
    searchSources,
    selectedModel,
    modeOverride,
    inputChip,
  } = useAppSelector((s) => s.chatBar);
  const { vaneOnline } = useSearchHealth();

  const inputRef = useRef<ChatInputBarHandle>(null);
  const [showRecent, setShowRecent] = useState(!activeSessionId);
  const [modal, setModal] = useState<ModalState>(INITIAL_MODAL);

  const { data: session, isLoading: sessionLoading } = useGetSessionQuery(
    activeSessionId ?? '',
    { skip: !activeSessionId },
  );

  const [createSession] = useCreateSessionMutation();
  const [sendMessage] = useSendMessageMutation();
  const [shareSession] = useShareSessionMutation();
  const [unshareSession] = useUnshareSessionMutation();
  const [saveSnippet] = useSaveSnippetToNicheMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const { start: startStream } = useSendMessageStream({
    sessionId: activeSessionId,
    onDone: () => {
      dispatch(setSearching(false));
      // Phase 7 — release attachments after the message persisted.
      dispatch(clearAttachments());
    },
  });
  // Phase 7 — pull completed attachment ids at submit-time so they ride along
  // with the SSE URL.
  const attachmentUploads = useAppSelector((s) => s.attachments.uploads);

  const messages = session?.messages ?? [];
  // The drawer ChatPanel only ever serves the OWNER's sessions. The public
  // read-only view lives at `/shared/chat/:token` (SharedChatView). Sharing
  // a session must NOT lock the owner out of their own toolbar/input.
  const isReadOnly = false;
  const isStreaming = useAppSelector(
    (s) => s.chatBar.streamingAssistantMessage.isStreaming,
  );

  // PROJ-20 Phase 3.7 — chip + text are read at submit time from the
  // ChatInputBar imperative handle (EC-10). We still consult the Redux
  // `modeOverride`, `searchSources`, `selectedModel` because those are
  // session-level controls toggled outside the input bar.
  const handleSubmit = useCallback(
    async (payload: ChatInputBarSubmitPayload) => {
      const trimmed = payload.text.trim();
      if (!trimmed || searching || !vaneOnline || isStreaming) return;

      const niche_id = payload.chip?.niche_id ?? null;

      dispatch(setSearching(true));
      inputRef.current?.clear();

      try {
        let sessionId = activeSessionId;
        if (!sessionId) {
          const newSession = await createSession({
            niche_context: niche_id ?? undefined,
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
              search_sources: searchSources,
              model: selectedModel,
              mode_override: modeOverride,
            },
          }).unwrap();
          dispatch(setSearching(false));
        } else {
          const attachment_ids = attachmentUploads
            .filter((u) => u.status === 'completed' && u.serverId)
            .map((u) => u.serverId as string);
          startStream({
            content: trimmed,
            mode_override: modeOverride,
            niche_id,
            sessionIdOverride: sessionId,
            attachment_ids,
          });
          // searching cleared by useSendMessageStream onDone callback
        }
      } catch {
        enqueueSnackbar(t('search.chat.sendError'), { variant: 'error' });
        dispatch(setSearching(false));
      }
    },
    [
      searching,
      vaneOnline,
      isStreaming,
      activeSessionId,
      searchSources,
      selectedModel,
      modeOverride,
      attachmentUploads,
      dispatch,
      createSession,
      sendMessage,
      startStream,
      enqueueSnackbar,
      t,
    ],
  );

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
      if (!inputChip) {
        setModal({ open: true, selectedText: trimmed, saveAs, sourceUrl });
        return;
      }

      // Active niche context → save directly
      try {
        const result = await saveSnippet({
          nicheId: inputChip.niche_id,
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
    [inputChip, saveSnippet, enqueueSnackbar, t],
  );

  const handleSaveSelectionAsKeywords = useCallback(
    (text: string, sourceUrl?: string) => handleSaveSelection('keywords', text, sourceUrl),
    [handleSaveSelection],
  );

  const handleSaveSelectionAsNotes = useCallback(
    (text: string, sourceUrl?: string) => handleSaveSelection('notes', text, sourceUrl),
    [handleSaveSelection],
  );

  // PROJ-20 Phase 5.3 — Regenerate: delete the current assistant message,
  // then re-stream from the prior user prompt with the same mode/sources/model.
  // EC-7: if delete fails, do NOT start the new stream; show an error toast.
  const handleRegenerate = useCallback(
    async (assistantMessage: ChatMessage, priorUserContent: string) => {
      if (!activeSessionId) return;
      try {
        await deleteMessage(assistantMessage.id).unwrap();
      } catch {
        enqueueSnackbar(t('search.actions.regenerateError'), {
          variant: 'error',
        });
        return;
      }
      const niche_id = inputChip?.niche_id ?? null;
      if (modeOverride === 'agent') {
        try {
          await sendMessage({
            sessionId: activeSessionId,
            body: {
              content: priorUserContent,
              search_sources: searchSources,
              model: selectedModel,
              mode_override: modeOverride,
            },
          }).unwrap();
        } catch {
          enqueueSnackbar(t('search.chat.sendError'), { variant: 'error' });
        }
      } else {
        startStream({
          content: priorUserContent,
          mode_override: modeOverride,
          niche_id,
          sessionIdOverride: activeSessionId,
        });
      }
    },
    [
      activeSessionId,
      deleteMessage,
      enqueueSnackbar,
      t,
      inputChip,
      modeOverride,
      searchSources,
      selectedModel,
      sendMessage,
      startStream,
    ],
  );

  // PROJ-20 Phase 5.5 — Save answer to a niche. With active chip → direct save.
  // Without chip → open existing SaveToNicheModal pre-filled with the answer.
  const handleSaveAnswer = useCallback(
    async (assistantMessage: ChatMessage) => {
      const trimmed = assistantMessage.content.trim();
      if (!trimmed) return;
      if (!inputChip) {
        setModal({
          open: true,
          selectedText: trimmed,
          saveAs: 'notes',
          sourceUrl: undefined,
        });
        return;
      }
      try {
        await saveSnippet({
          nicheId: inputChip.niche_id,
          body: { selected_text: trimmed, save_as: 'notes' },
        }).unwrap();
        enqueueSnackbar(t('search.save.successNote'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('search.save.errorGeneric'), { variant: 'error' });
      }
    },
    [inputChip, saveSnippet, enqueueSnackbar, t],
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
            <IconButton
              size="small"
              onClick={() => {
                dispatch(setActiveSession(null));
                dispatch(clearAttachments());
                inputRef.current?.clear();
                setShowRecent(false);
                inputRef.current?.focus();
              }}
              aria-label={t('search.sessions.newChat')}
              title={t('search.sessions.newChat')}
              sx={{ borderRadius: 1.5 }}
            >
              <AddIcon sx={{ fontSize: 20 }} />
            </IconButton>
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
          </Stack>
        </Stack>
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
        sessionId={activeSessionId ?? undefined}
        onRegenerate={isReadOnly ? undefined : handleRegenerate}
        onSaveAnswer={isReadOnly ? undefined : handleSaveAnswer}
      />

      {/* Input area — PROJ-20 Phase 3.7 unified ChatInputBar */}
      {!isReadOnly && (
        <InputArea>
          <ChatInputBar
            ref={inputRef}
            appearance="panel"
            onSubmit={handleSubmit}
            isSending={searching || isStreaming}
            disabled={!vaneOnline}
          />
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
