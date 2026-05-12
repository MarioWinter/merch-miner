import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
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
  SaveSnippetKeywordsResponse,
  SaveSnippetNotesResponse,
} from '@/types/search';
import ChatInputBar, {
  type ChatInputBarHandle,
  type ChatInputBarSubmitPayload,
} from './ChatInputBar';
import ChatMessageList from './ChatMessageList';
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

/**
 * PROJ-29 Phase 1F: workspace-scoped active-session pointer in localStorage.
 * Lets a returning user re-open the same chat after refresh / re-login.
 * Read-and-write helpers are colocated so the key shape stays a single source
 * of truth with the logout cleanup in `ProfileMenu`.
 */
const activeChatKey = (workspaceId: string | null | undefined) =>
  workspaceId ? `mm-active-chat-session-${workspaceId}` : null;

const readPersistedActiveChat = (workspaceId: string | null): string | null => {
  if (typeof window === 'undefined') return null;
  const key = activeChatKey(workspaceId);
  if (!key) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writePersistedActiveChat = (
  workspaceId: string | null,
  sessionId: string | null,
): void => {
  if (typeof window === 'undefined') return;
  const key = activeChatKey(workspaceId);
  if (!key) return;
  try {
    if (sessionId) window.localStorage.setItem(key, sessionId);
    else window.localStorage.removeItem(key);
  } catch {
    /* quota / privacy — ignore */
  }
};

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
  const activeWorkspaceId = useAppSelector(
    (s) => s.workspace?.activeWorkspaceId ?? null,
  );
  const { vaneOnline } = useSearchHealth();

  const inputRef = useRef<ChatInputBarHandle>(null);
  const [modal, setModal] = useState<ModalState>(INITIAL_MODAL);

  // PROJ-29 Phase 1F: on mount + whenever the active workspace flips, try to
  // restore the persisted session id. Only sets when Redux currently has no
  // active session — never clobbers an in-progress session.
  const restoreAttemptedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeWorkspaceId) return;
    if (restoreAttemptedRef.current === activeWorkspaceId) return;
    restoreAttemptedRef.current = activeWorkspaceId;
    if (activeSessionId) return;
    const persisted = readPersistedActiveChat(activeWorkspaceId);
    if (persisted) {
      dispatch(setActiveSession(persisted));
    }
  }, [activeWorkspaceId, activeSessionId, dispatch]);

  const { data: session, isLoading: sessionLoading, error: sessionError } = useGetSessionQuery(
    activeSessionId ?? '',
    { skip: !activeSessionId },
  );

  // PROJ-29 Phase 1F: persist the active session id per workspace so a
  // refresh / re-login restores the same chat. Silently drop the pointer if
  // the backend 404s (session deleted by user or admin).
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const status =
      sessionError && typeof sessionError === 'object' && 'status' in sessionError
        ? (sessionError as { status?: number }).status
        : undefined;
    if (status === 404) {
      writePersistedActiveChat(activeWorkspaceId, null);
      dispatch(setActiveSession(null));
      return;
    }
    writePersistedActiveChat(activeWorkspaceId, activeSessionId);
  }, [activeWorkspaceId, activeSessionId, sessionError, dispatch]);

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
    // Mirror the onDone reset on Vane 500 / connection-loss / silence-timeout
    // so the panel doesn't stay locked at `searching = true`.
    onError: () => {
      dispatch(setSearching(false));
      dispatch(clearAttachments());
    },
  });
  // Phase 7 — pull completed attachment ids at submit-time so they ride along
  // with the SSE URL.
  const attachmentUploads = useAppSelector((s) => s.attachments.uploads);

  // Gate on activeSessionId — RTK Query keeps previous data even when
  // `skip: true` flips back; without this gate the previous session's
  // messages bleed through after "+ New chat" clears the active id.
  const messages = activeSessionId ? session?.messages ?? [] : [];
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
      const niche_id = payload.chip?.niche_id ?? null;
      // PROJ-29 Phase 1I follow-up: niche-bound + agent-mode sends route to
      // run_chat (no Vane dependency). Only require Vane online when neither
      // a niche chip nor agent mode is active.
      const needsVane =
        niche_id === null &&
        session?.niche_context == null &&
        modeOverride !== 'agent';
      if (!trimmed || searching || isStreaming) return;
      if (needsVane && !vaneOnline) return;

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
            model: selectedModel,
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
      // PROJ-29 Phase 1I follow-up: handleSubmit reads `session?.niche_context`
      // to decide whether the request needs Vane. Listed here so the callback
      // re-binds when session changes (also satisfies react-hooks/exhaustive-deps).
      session?.niche_context,
      attachmentUploads,
      dispatch,
      createSession,
      sendMessage,
      startStream,
      enqueueSnackbar,
      t,
    ],
  );

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
    async (assistantMessage: ChatMessage, priorUserMessage: ChatMessage) => {
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
      const priorUserContent = priorUserMessage.content;
      // Carry the original user message's attachments through Regenerate so
      // vision-mode answers don't hallucinate when the user re-runs an image
      // query. Without this, the new SSE call drops attachment_ids and the
      // backend falls back to text-only mode against the same prompt.
      const attachment_ids = priorUserMessage.attachments?.map((a) => a.id) ?? [];
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
          attachment_ids: attachment_ids.length > 0 ? attachment_ids : undefined,
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
      {/* Per-session toolbar — only Share button (history + new-chat moved to drawer header). */}
      {activeSessionId && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="flex-end"
          sx={{ px: 1.5, pt: 0.75, pb: 0.5, flexShrink: 0 }}
        >
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
        </Stack>
      )}

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
        sessionNicheId={session?.niche_context_id ?? null}
        onFollowUpClick={
          isReadOnly
            ? undefined
            : (text) => void handleSubmit({ text, chip: inputChip })
        }
      />

      {/* Input area — PROJ-20 Phase 3.7 unified ChatInputBar */}
      {!isReadOnly && (
        <InputArea>
          <ChatInputBar
            ref={inputRef}
            appearance="panel"
            onSubmit={handleSubmit}
            isSending={searching || isStreaming}
            // PROJ-29 Phase 1I follow-up: input always typeable so users can
            // insert an @-mention even when Vane is degraded — `handleSubmit`
            // gates the actual send when no niche context AND Vane is offline.
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
