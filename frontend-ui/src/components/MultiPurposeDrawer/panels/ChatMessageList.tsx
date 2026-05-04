import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Box, Button, Stack, Typography, Skeleton } from '@mui/material';
import { styled, alpha, keyframes } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '@/types/search';
import { useAppSelector } from '@/store/hooks';
import JumpToLatestButton from './JumpToLatestButton';
import WorkflowCard from './WorkflowCard';
import SaveSnippetToolbar from './SaveSnippetToolbar';
import MarkdownAnswer from './partials/MarkdownAnswer';
import MessageActionToolbar from './partials/MessageActionToolbar';
import SourceList from './partials/SourceList';
import UserAttachments from './partials/UserAttachments';

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
}: ChatMessageListProps) => {
  const { t } = useTranslation();
  // BUG-2 fix (2026-04-28): a useRef + useEffect pair was prone to HMR
  // staleness — when ChatMessageList re-mounted via Vite HMR, the previous
  // effect's cleanup sometimes ran AFTER the new effect attached its
  // listener, leaving the live ScrollContainer without a working handler.
  // Use a callback-ref instead: attach/detach the listener inline with the
  // node lifecycle so HMR fast-refresh can never desync the two.
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollElRef = useRef<HTMLDivElement | null>(null);

  // AC-39/40: auto-scroll engaged by default, disengages on user scroll-up
  const [autoScroll, setAutoScroll] = useState(true);

  // PROJ-17 Phase 4 Step 6: live streaming bubble state
  const streamingMessage = useAppSelector(
    (s) => s.chatBar.streamingAssistantMessage,
  );
  const showStreamingBubble =
    streamingMessage.isStreaming && streamingMessage.content !== '';

  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    // Detach from previous element (HMR may keep an old node alive briefly).
    const prev = scrollElRef.current;
    if (prev && (prev as unknown as { __mmHandler?: EventListener }).__mmHandler) {
      const h = (prev as unknown as { __mmHandler?: EventListener }).__mmHandler;
      if (h) prev.removeEventListener('scroll', h);
      delete (prev as unknown as { __mmHandler?: EventListener }).__mmHandler;
    }
    scrollElRef.current = node;
    if (!node) return;
    const handler: EventListener = () => {
      const el = scrollElRef.current;
      if (!el) return;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distance <= AUTO_SCROLL_THRESHOLD;
      setAutoScroll((curr) => (curr === atBottom ? curr : atBottom));
    };
    (node as unknown as { __mmHandler?: EventListener }).__mmHandler = handler;
    node.addEventListener('scroll', handler, { passive: true });
  }, []);

  // Scroll to bottom on new messages or streaming chunk — only if autoScroll
  // engaged. Use 'auto' (instant) to avoid kicking off smooth-scroll
  // animations that retrigger the scroll listener and feed back into the
  // autoScroll state, which could cause Maximum-update-depth in chunk-heavy
  // streams.
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages.length, autoScroll, streamingMessage.content]);

  const handleJumpToLatest = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
  }, []);

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
    <Wrapper data-auto-scroll={autoScroll ? 'true' : 'false'}>
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
                  <Stack alignItems="flex-end" gap={0.5} sx={{ maxWidth: '85%' }}>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <UserAttachments attachments={msg.attachments} />
                    )}
                    <UserBubble>{msg.content}</UserBubble>
                  </Stack>
                ) : isWorkflow && msg.agent_session ? (
                  /* AC-42: Workflow-Card inline; takes full row width. */
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <WorkflowCard agentSessionRef={msg.agent_session} />
                  </Box>
                ) : (
                  <AssistantContent>
                    <AssistantBubble>
                      <MarkdownAnswer
                        content={msg.content}
                        sources={msg.sources ?? []}
                        messageId={msg.id}
                      />
                    </AssistantBubble>
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
                  <MarkdownAnswer
                    content={streamingMessage.content}
                    sources={streamingMessage.sources}
                    messageId={streamingMessage.id ?? STREAMING_MESSAGE_ID}
                  />
                  <TypingCursor aria-hidden="true" />
                </AssistantBubble>
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

        <div ref={bottomRef} />
      </ScrollContainer>

      <JumpToLatestButton onClick={handleJumpToLatest} visible={!autoScroll} />

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
