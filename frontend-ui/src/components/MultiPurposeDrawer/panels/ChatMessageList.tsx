import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Avatar, Box, Button, Stack, Typography, Skeleton } from '@mui/material';
import { styled, alpha, keyframes } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ErrorIconOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '@/types/search';
import type { SloganRow } from '@/types/chat-rag';
import { useAppSelector } from '@/store/hooks';
import JumpToLatestButton from './JumpToLatestButton';
import HistoryNicheChip from './HistoryNicheChip';
import WorkflowCard from './WorkflowCard';
import SaveSnippetToolbar from './SaveSnippetToolbar';
import MarkdownAnswer from './partials/MarkdownAnswer';
import MessageActionToolbar from './partials/MessageActionToolbar';
import SourceList from './partials/SourceList';
import UserAttachments from './partials/UserAttachments';
import UserMessageToolbar from './partials/UserMessageToolbar';
import ThinkingStrip from '@/components/ThinkingStrip';
import GeneratedSloganTable from '@/components/GeneratedSloganTable';
import FollowUpChips from '@/components/FollowUpChips';

// Stable id used for the in-flight streaming bubble's citation lookup so
// SourceCards rendered for the streaming message can be linked from `[N]`.
const STREAMING_MESSAGE_ID = 'streaming';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  /** Pattern B inline source actions — bubbled up to ChatPanel for save-to-niche modal logic. */
  onSaveKeywords?: (url: string, snippet: string) => void;
  onSaveNotes?: (url: string, snippet: string) => void;
  /** AC-50–53: text-selection toolbar handlers. sourceUrl is the optional containing source URL
   *  (defined when selection lives inside a SourceCard; undefined for assistant bubble text). */
  onSaveSelectionAsKeywords?: (selectedText: string, sourceUrl?: string) => void;
  onSaveSelectionAsNotes?: (selectedText: string, sourceUrl?: string) => void;
  /** PROJ-20 Phase 5 — Action Toolbar callbacks. Required to render the toolbar
   *  under each assistant bubble. Toolbar is hidden when these are absent
   *  (e.g. on the read-only public-share viewer). */
  sessionId?: string;
  onRegenerate?: (assistantMessage: ChatMessage, priorUserMessage: ChatMessage) => void;
  onSaveAnswer?: (assistantMessage: ChatMessage) => void;
  /** PROJ-29 Phase 1H-2: session.niche_context — drives Add-to-Niche flow. */
  sessionNicheId?: string | null;
  /** PROJ-29 Phase 1H-2: invoked when user clicks a FollowUpChip. */
  onFollowUpClick?: (text: string) => void;
  /** PROJ-29 Phase 1J follow-up: re-send a previous user message. Wired
   *  through to the existing `startStream` path by the parent. Only the
   *  Retry icon's visibility depends on the next-message error pairing —
   *  the callback itself is always invoked with the original user content. */
  onRetry?: (userMessage: ChatMessage) => void;
}

/** Distance from bottom (px) within which we consider the user "at the bottom" and re-engage auto-scroll. */
const AUTO_SCROLL_THRESHOLD = 50;

const Wrapper = styled(Box)({
  flex: 1,
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const ScrollContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: `${theme.spacing(2)} ${theme.spacing(2)} ${theme.spacing(3)}`,
}));

/**
 * Per-message row. Flex container so child bubble can be aligned via `alignSelf`
 * AND the avatar (if present) sits side-by-side with the bubble.
 */
const MessageRow = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'role',
})<{ role: 'user' | 'assistant' }>(({ theme, role }) => ({
  display: 'flex',
  flexDirection: role === 'user' ? 'row-reverse' : 'row',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
  width: '100%',
  // PROJ-29 Phase 1J follow-up — hover-reveal user-message toolbar.
  // CSS-only: avoids a JS hover state that would re-render every row on
  // scroll. The toolbar starts at opacity:0 (see UserMessageToolbar) and
  // becomes visible when the row is hovered or any inner control is focused.
  '&:hover .user-msg-actions, &:focus-within .user-msg-actions': {
    opacity: 1,
  },
}));

/** Right-side bubble — primary red, white text, classic chat-app look. */
const UserBubble = styled(Box)(({ theme }) => ({
  maxWidth: '85%',
  padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
  borderRadius: '14px 14px 4px 14px',
  backgroundColor: theme.vars.palette.primary.main,
  color: theme.vars.palette.primary.contrastText,
  fontSize: '0.875rem',
  lineHeight: 1.5,
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
  boxShadow: `0 1px 2px ${alpha('#000', 0.15)}`,
}));

/** Left-side bubble — paper bg + subtle border, ChatGPT/Perplexity-style.
 *  Markdown styling lives inside MarkdownAnswer (Phase 4.3). */
const AssistantBubble = styled(Box)(({ theme }) => ({
  maxWidth: 'calc(100% - 40px)',
  padding: `${theme.spacing(1.25)} ${theme.spacing(1.5)}`,
  borderRadius: '4px 14px 14px 14px',
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
}));

/** PROJ-29 Phase 1J BUG-4 — error placeholder bubble. Persisted when the agent
 *  stream errors before producing a final answer; pairs with the user message
 *  so the chat list doesn't strand a question with no visible response. */
const ErrorBubble = styled(Box)(({ theme }) => ({
  maxWidth: 'calc(100% - 40px)',
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
  padding: `${theme.spacing(1.25)} ${theme.spacing(1.5)}`,
  borderRadius: '4px 14px 14px 14px',
  backgroundColor: alpha(theme.palette.error.main, 0.08),
  border: `1px solid ${alpha(theme.palette.error.main, 0.35)}`,
  color: theme.vars.palette.error.main,
  fontSize: '0.875rem',
  lineHeight: 1.5,
}));

/** Small AI avatar to the left of assistant bubbles — ChatGPT-style. */
const AssistantAvatar = styled(Avatar)(({ theme }) => ({
  width: 28,
  height: 28,
  flexShrink: 0,
  backgroundColor: alpha(theme.palette.secondary.main, 0.15),
  color: theme.vars.palette.secondary.main,
  border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
  marginTop: 2,
}));

/** Timestamp aligned under each bubble row. */
const Timestamp = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'role',
})<{ role: 'user' | 'assistant' }>(({ theme, role }) => ({
  fontSize: '0.6875rem',
  color: theme.vars.palette.text.disabled,
  textAlign: role === 'user' ? 'right' : 'left',
  paddingLeft: role === 'assistant' ? theme.spacing(4.5) : 0,
  paddingRight: role === 'user' ? theme.spacing(0.5) : 0,
  marginTop: theme.spacing(0.25),
}));

/** Wraps assistant bubble + sources so MessageRow only deals with one flex child next to avatar. */
const AssistantContent = styled(Stack)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  gap: theme.spacing(0.75),
}));

// PROJ-17 Phase 4 Step 6: blinking caret for the live streaming bubble
const blink = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0 },
});

const TypingCursor = styled('span')(({ theme }) => ({
  display: 'inline-block',
  width: 2,
  height: '1em',
  marginLeft: 2,
  verticalAlign: 'text-bottom',
  backgroundColor: theme.vars.palette.text.primary,
  animation: `${blink} 1s step-start infinite`,
}));

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const ChatMessageList = ({
  messages, isLoading, hasMore, onLoadMore,
  onSaveKeywords, onSaveNotes,
  onSaveSelectionAsKeywords, onSaveSelectionAsNotes,
  sessionId, onRegenerate, onSaveAnswer,
  sessionNicheId = null, onFollowUpClick,
  onRetry,
}: ChatMessageListProps) => {
  const { t } = useTranslation();
  // FIX-chat-bugfixes-and-grouping Item 5 (Phase 4) — auto-scroll engine.
  //
  // Replaces the previous `scroll` event listener with an IntersectionObserver
  // watching a sentinel `<div>` at the bottom of the ScrollContainer. The
  // sentinel approach is more reliable than measuring `scrollHeight` because
  // the observer re-evaluates automatically on layout shifts (image loads,
  // bubble growth, textarea resize — EC-5-1 / EC-5-5).
  //
  // BUG-2 fix (2026-04-28, preserved here): the callback-ref pattern is the
  // HMR-resilience defence. A `useRef` + `useEffect` pair was prone to staleness
  // on Vite fast-refresh — the previous effect's cleanup sometimes ran AFTER
  // the new effect attached, leaving the live ScrollContainer without a
  // working observer. The callback-ref attaches the IO inline with the node
  // lifecycle so HMR re-mount can never desync the two (EC-5-3).
  const scrollElRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // `userAtBottomRef` is read synchronously inside effects; `userAtBottomState`
  // mirrors it for re-render purposes (JumpToLatestButton visibility).
  const userAtBottomRef = useRef(true);
  const [userAtBottomState, setUserAtBottomState] = useState(true);

  // Coalesce scroll-during-stream into one rAF. Multiple chunk events within a
  // single frame only schedule a single scrollTo.
  const rafIdRef = useRef<number | null>(null);

  // Track last-seen tail message id to distinguish "tail grew" (auto-scroll)
  // from "head prepended" (do NOT auto-scroll — EC-5-4).
  const prevLastMessageIdRef = useRef<string | null>(null);

  // Track whether the initial mount scroll has fired. Used to flip from "empty
  // → non-empty" without re-firing on every later render.
  const didInitialScrollRef = useRef(false);

  // PROJ-17 Phase 4 Step 6: live streaming bubble state
  const streamingMessage = useAppSelector(
    (s) => s.chatBar.streamingAssistantMessage,
  );
  // PROJ-29 Phase 1H-2 — slogan payloads (live + persisted-after-done)
  const streamingSloganPayload = useAppSelector(
    (s) => s.chatBar?.streamingSloganPayload ?? null,
  );
  const completedSloganPayload = useAppSelector(
    (s) => s.chatBar?.completedSloganPayload ?? null,
  );
  const showStreamingBubble =
    streamingMessage.isStreaming && streamingMessage.content !== '';

  // Last assistant message index — drives "render FollowUpChips here only" rule.
  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  })();

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const el = scrollElRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Callback-ref for the scroll container. Tears down any previous observer
  // (HMR may briefly keep the prior node alive) before binding the new one.
  // The sentinel is mounted as a sibling JSX node and observed via a separate
  // effect once both refs are stable.
  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    scrollElRef.current = node;
  }, []);

  // Wire the IntersectionObserver once both refs are bound. The observer fires
  // whenever the sentinel crosses the threshold (50 px before the bottom edge
  // of the viewport), giving us a layout-shift-safe `userAtBottom` signal.
  useEffect(() => {
    const root = scrollElRef.current;
    const sentinel = bottomSentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const atBottom = entry.isIntersecting;
        userAtBottomRef.current = atBottom;
        setUserAtBottomState((curr) => (curr === atBottom ? curr : atBottom));
      },
      {
        root,
        rootMargin: `${AUTO_SCROLL_THRESHOLD}px`,
        threshold: 0,
      },
    );
    observer.observe(sentinel);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      if (observerRef.current === observer) observerRef.current = null;
    };
    // Re-run when the scroll container is replaced (HMR) or when messages
    // toggle the JSX tree between skeleton / empty-state / list paths.
  }, [messages.length, showStreamingBubble, isLoading]);

  // AC-5-3 / AC-5-4 — initial scroll (instant, pre-paint) on mount AND on
  // empty→non-empty transition. Re-mounting via parent `key={activeSessionId}`
  // resets `didInitialScrollRef` automatically (new component instance).
  useLayoutEffect(() => {
    if (messages.length === 0) return;
    if (didInitialScrollRef.current) return;
    const el = scrollElRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'instant' as ScrollBehavior });
    didInitialScrollRef.current = true;
    // Seed the prevLastMessageIdRef so the "new persisted message" effect
    // below does not treat this initial render as a tail-growth event.
    prevLastMessageIdRef.current = messages[messages.length - 1]?.id ?? null;
    // Only re-run on length transitions; depending on `messages` (the array
    // reference) would re-fire on every render and defeat the guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // AC-5-5 — smooth scroll on each streaming chunk, rAF-coalesced.
  // Watches the streaming content length (the cheapest stable signal for
  // "a new chunk landed in Redux"). Only fires when the user is at the
  // bottom AND a stream is in progress.
  useEffect(() => {
    if (!streamingMessage.isStreaming) return;
    if (!userAtBottomRef.current) return;
    if (rafIdRef.current !== null) return; // already queued — coalesce.
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      scrollToBottom('smooth');
    });
  }, [streamingMessage.content, streamingMessage.isStreaming, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  // AC-5-6 / EC-5-4 — new persisted message arrival.
  // Only auto-scroll when the TAIL grew (last message id changed). A grown
  // messages array whose last id is unchanged is a head-prepend (Load more)
  // and must NOT yank the viewport down.
  useEffect(() => {
    if (messages.length === 0) {
      prevLastMessageIdRef.current = null;
      return;
    }
    const newLastId = messages[messages.length - 1]?.id ?? null;
    const prevLastId = prevLastMessageIdRef.current;
    // First observation after the initial-scroll effect — seed silently.
    if (prevLastId === null) {
      prevLastMessageIdRef.current = newLastId;
      return;
    }
    if (newLastId === prevLastId) return;
    prevLastMessageIdRef.current = newLastId;
    if (!userAtBottomRef.current) return;
    // Defer to next frame so the new DOM has committed before we measure.
    const id = requestAnimationFrame(() => {
      scrollToBottom('smooth');
    });
    return () => cancelAnimationFrame(id);
  }, [messages, scrollToBottom]);

  const handleJumpToLatest = useCallback(() => {
    userAtBottomRef.current = true;
    setUserAtBottomState(true);
    scrollToBottom('smooth');
  }, [scrollToBottom]);

  if (isLoading && messages.length === 0) {
    return (
      <Wrapper>
        <ScrollContainer ref={setScrollRef}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rounded"
              width={i % 2 === 0 ? '60%' : '80%'}
              height={48}
              sx={{ alignSelf: i % 2 === 0 ? 'flex-end' : 'flex-start', borderRadius: 3 }}
            />
          ))}
          <div ref={bottomSentinelRef} aria-hidden="true" />
        </ScrollContainer>
      </Wrapper>
    );
  }

  // Empty state — only when there's no streaming response either. We must NOT
  // short-circuit here while a stream is in progress, otherwise the live
  // streaming bubble below never renders for the FIRST message of a new
  // session (messages array stays empty until the assistant message persists).
  if (messages.length === 0 && !showStreamingBubble) {
    return (
      <Wrapper>
        <Stack flex={1} alignItems="center" justifyContent="center" gap={1.5} sx={{ py: 6, px: 3 }}>
          <AssistantAvatar sx={{ width: 48, height: 48 }}>
            <AutoAwesomeIcon sx={{ fontSize: 24 }} />
          </AssistantAvatar>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 320 }}>
            {t('search.empty.firstSearchHint')}
          </Typography>
        </Stack>
      </Wrapper>
    );
  }

  return (
    <Wrapper data-auto-scroll={userAtBottomState ? 'true' : 'false'}>
      <ScrollContainer ref={setScrollRef}>
        {hasMore && (
          <Button
            size="small"
            onClick={onLoadMore}
            sx={{ alignSelf: 'center', mb: 0.5, textTransform: 'none', fontSize: '0.75rem' }}
          >
            {t('search.chat.loadMore')}
          </Button>
        )}

        {messages.map((msg, idx) => {
          const role: 'user' | 'assistant' = msg.role === 'user' ? 'user' : 'assistant';
          const isWorkflow =
            msg.message_type === 'workflow_card' && msg.agent_session;

          // For assistant bubbles, look back for the most recent user message
          // to drive Regenerate. Walking the array backwards from idx-1
          // tolerates mixed message types (e.g. workflow cards in between).
          let priorUserMessage: ChatMessage | null = null;
          if (msg.role === 'assistant') {
            for (let i = idx - 1; i >= 0; i -= 1) {
              if (messages[i].role === 'user') {
                priorUserMessage = messages[i];
                break;
              }
            }
          }

          return (
            <Box key={msg.id}>
              <MessageRow role={role}>
                {role === 'assistant' && !isWorkflow && (
                  <AssistantAvatar aria-hidden="true">
                    <AutoAwesomeIcon sx={{ fontSize: 16 }} />
                  </AssistantAvatar>
                )}

                {msg.role === 'user' ? (
                  (() => {
                    // PROJ-29 Phase 1J follow-up — only attach Retry when the
                    // next sibling message is a persisted error placeholder.
                    // Copy is always available via the hover-reveal toolbar.
                    const nextMsg = messages[idx + 1];
                    const followedByError =
                      nextMsg?.role === 'assistant' &&
                      nextMsg?.message_type === 'error';
                    const retryHandler =
                      onRetry && followedByError
                        ? () => onRetry(msg)
                        : undefined;
                    return (
                      <Stack
                        alignItems="flex-end"
                        gap={0.5}
                        sx={{ maxWidth: '85%' }}
                      >
                        {/* FIX-chat-bugfixes-and-grouping Item 4 — per-message
                         *  @niche reference chip. Read-only; rendered only
                         *  when the persisted user message carries a
                         *  referenced niche name. */}
                        {msg.referenced_niche_name && (
                          <HistoryNicheChip
                            name={msg.referenced_niche_name}
                            nicheId={msg.referenced_niche_id}
                          />
                        )}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <UserAttachments attachments={msg.attachments} />
                        )}
                        <UserBubble>{msg.content}</UserBubble>
                        <UserMessageToolbar
                          content={msg.content}
                          onRetry={retryHandler}
                        />
                      </Stack>
                    );
                  })()
                ) : isWorkflow && msg.agent_session ? (
                  /* AC-42: Workflow-Card inline; takes full row width. */
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <WorkflowCard agentSessionRef={msg.agent_session} />
                  </Box>
                ) : msg.message_type === 'error' ? (
                  /* PROJ-29 Phase 1J BUG-4 — paired error bubble when the agent
                     stream failed before producing a final answer. */
                  <AssistantContent>
                    <ErrorBubble role="alert">
                      <ErrorIconOutlinedIcon sx={{ fontSize: 18, mt: 0.25, flexShrink: 0 }} />
                      <Stack gap={0.25}>
                        <Box sx={{ fontWeight: 600 }}>
                          {t('search.chat.errorBubble.title', 'Something went wrong')}
                        </Box>
                        <Box>{msg.content}</Box>
                      </Stack>
                    </ErrorBubble>
                  </AssistantContent>
                ) : (
                  <AssistantContent>
                    <AssistantBubble>
                      {/* PROJ-29 Phase 1H — ThinkingStrip for persisted messages.
                       *  No persisted thinking metadata yet (Phase 1I) — strip
                       *  renders nothing until backend wiring lands. */}
                      <ThinkingStrip
                        messageId={msg.id}
                        isStreaming={false}
                        persistedSteps={msg.thinking_stages ?? undefined}
                        persistedChunksUsed={msg.chunks_used ?? undefined}
                        persistedDurationMs={(() => {
                          // Compute total elapsed from earliest stage ts to the
                          // last terminal (done/warning/error) ts. Falls back
                          // to sum of durationMs when ts gap is unavailable.
                          const stages = msg.thinking_stages ?? [];
                          if (stages.length === 0) return undefined;
                          const first = stages[0].ts;
                          const last = stages[stages.length - 1];
                          const lastEnd = last.ts + (last.durationMs ?? 0);
                          return Math.max(0, lastEnd - first);
                        })()}
                      />
                      <MarkdownAnswer
                        content={msg.content}
                        sources={msg.sources ?? []}
                        messageId={msg.id}
                      />
                    </AssistantBubble>
                    {/* PROJ-29 Phase 1H-2/1I — slogan table for the just-finished
                     *  agent turn. Phase 1I persists the payload on the
                     *  ChatMessage row itself (`msg.generate_slogans_payload`)
                     *  so the table re-renders after page reload. The Redux
                     *  fallback covers the small window between `done` and
                     *  the RTK Query refetch landing the persisted message. */}
                    {(() => {
                      const persistedRows =
                        msg.generate_slogans_payload?.slogans as
                          | SloganRow[]
                          | undefined;
                      const reduxRows =
                        completedSloganPayload?.messageId === msg.id
                          ? completedSloganPayload.rows
                          : undefined;
                      const rows = persistedRows ?? reduxRows;
                      if (!rows || rows.length === 0) return null;
                      return (
                        <GeneratedSloganTable
                          rows={rows}
                          sessionNicheId={sessionNicheId}
                        />
                      );
                    })()}
                    {/* PROJ-29 Phase 1H-2 — follow-up chips on the LAST
                     *  assistant message only (graceful EC-20 + Q5A above
                     *  MessageActionToolbar). */}
                    {idx === lastAssistantIdx && onFollowUpClick && (
                      <FollowUpChips onSelect={onFollowUpClick} />
                    )}
                    {/* PROJ-20 Phase 5 — Action Toolbar (AC-30 to AC-34) */}
                    {sessionId && onRegenerate && onSaveAnswer && (
                      <MessageActionToolbar
                        messageId={msg.id}
                        content={msg.content}
                        sessionId={sessionId}
                        isOwnMessageStreaming={false}
                        isAnyStreamActive={streamingMessage.isStreaming}
                        canRegenerate={priorUserMessage !== null}
                        onRegenerate={() =>
                          priorUserMessage &&
                          onRegenerate(msg, priorUserMessage)
                        }
                        onSaveAnswer={() => onSaveAnswer(msg)}
                      />
                    )}
                    {/* AC-38: Sources collapsed by default below AI bubble
                     *  (Perplexity-style trigger). Auto-expands when a
                     *  citation `[N]` in the same message is clicked. */}
                    {msg.sources && msg.sources.length > 0 && (
                      <SourceList
                        sources={msg.sources}
                        messageId={msg.id}
                        onSaveKeywords={onSaveKeywords}
                        onSaveNotes={onSaveNotes}
                      />
                    )}
                  </AssistantContent>
                )}
              </MessageRow>
              <Timestamp role={role} variant="caption">
                {formatTime(msg.created_at)}
              </Timestamp>
            </Box>
          );
        })}

        {/* PROJ-17 Phase 4 Step 6: live streaming assistant bubble (virtual — replaced by persisted msg on done) */}
        {showStreamingBubble && (
          <Box>
            <MessageRow role="assistant">
              <AssistantAvatar aria-hidden="true">
                <AutoAwesomeIcon sx={{ fontSize: 16 }} />
              </AssistantAvatar>
              <AssistantContent>
                <AssistantBubble aria-live="polite" aria-label={t('search.stream.streaming')}>
                  {/* PROJ-29 Phase 1H — live ThinkingStrip above the streaming answer. */}
                  <ThinkingStrip
                    messageId={streamingMessage.id ?? STREAMING_MESSAGE_ID}
                    isStreaming
                  />
                  <MarkdownAnswer
                    content={streamingMessage.content}
                    sources={streamingMessage.sources}
                    messageId={streamingMessage.id ?? STREAMING_MESSAGE_ID}
                  />
                  <TypingCursor aria-hidden="true" />
                </AssistantBubble>
                {/* PROJ-29 Phase 1H-2 — live slogan table during the streaming
                 *  turn. After `done` the payload moves to `completedSloganPayload`
                 *  keyed by message id, and the table re-attaches there. */}
                {streamingSloganPayload && streamingSloganPayload.length > 0 && (
                  <GeneratedSloganTable
                    rows={streamingSloganPayload}
                    sessionNicheId={sessionNicheId}
                  />
                )}
                {streamingMessage.sources.length > 0 && (
                  <SourceList
                    sources={streamingMessage.sources}
                    messageId={streamingMessage.id ?? STREAMING_MESSAGE_ID}
                    onSaveKeywords={onSaveKeywords}
                    onSaveNotes={onSaveNotes}
                  />
                )}
              </AssistantContent>
            </MessageRow>
          </Box>
        )}

        {/* AC-5-1 — bottom sentinel observed by IntersectionObserver above.
         *  Must remain the LAST child of ScrollContainer. */}
        <div ref={bottomSentinelRef} aria-hidden="true" />
      </ScrollContainer>

      <JumpToLatestButton onClick={handleJumpToLatest} visible={!userAtBottomState} />

      {/* AC-50–53: floating toolbar on text selection inside assistant bubbles + source snippets */}
      {(onSaveSelectionAsKeywords || onSaveSelectionAsNotes) && (
        <SaveSnippetToolbar
          containerRef={scrollElRef}
          onSaveKeywords={(text, sourceUrl) =>
            onSaveSelectionAsKeywords?.(text, sourceUrl)
          }
          onSaveNotes={(text, sourceUrl) =>
            onSaveSelectionAsNotes?.(text, sourceUrl)
          }
        />
      )}
    </Wrapper>
  );
};

export default ChatMessageList;
