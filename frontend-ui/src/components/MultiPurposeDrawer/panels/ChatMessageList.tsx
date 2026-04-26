import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Box, Button, Stack, Typography, Skeleton } from '@mui/material';
import { styled, alpha, keyframes } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '@/types/search';
import { useAppSelector } from '@/store/hooks';
import JumpToLatestButton from './JumpToLatestButton';
import SourceCard from './SourceCard';
import WorkflowCard from './WorkflowCard';
import SaveSnippetToolbar from './SaveSnippetToolbar';

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

/** Left-side bubble — paper bg + subtle border, ChatGPT/Perplexity-style. */
const AssistantBubble = styled(Box)(({ theme }) => ({
  maxWidth: 'calc(100% - 40px)',
  padding: `${theme.spacing(1.25)} ${theme.spacing(1.5)}`,
  borderRadius: '4px 14px 14px 14px',
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  fontSize: '0.875rem',
  lineHeight: 1.55,
  wordBreak: 'break-word',
  color: theme.vars.palette.text.primary,
  // Markdown styling
  '& > *:first-of-type': { marginTop: 0 },
  '& > *:last-child': { marginBottom: 0 },
  '& p': { margin: `${theme.spacing(0.5)} 0` },
  '& a': { color: theme.vars.palette.secondary.main, textDecoration: 'underline' },
  '& code': {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '0.8125rem',
    backgroundColor: alpha(theme.palette.common.black, 0.18),
    padding: '2px 5px',
    borderRadius: 4,
  },
  '& pre': {
    backgroundColor: alpha(theme.palette.common.black, 0.22),
    padding: theme.spacing(1.25),
    borderRadius: 8,
    overflowX: 'auto',
    margin: `${theme.spacing(0.75)} 0`,
    '& code': { backgroundColor: 'transparent', padding: 0 },
  },
  '& ul, & ol': { paddingLeft: theme.spacing(2.5), margin: `${theme.spacing(0.5)} 0` },
  '& li': { marginBottom: theme.spacing(0.25) },
  '& h1, & h2, & h3, & h4': { margin: `${theme.spacing(1)} 0 ${theme.spacing(0.5)}` },
  '& blockquote': {
    margin: `${theme.spacing(0.5)} 0`,
    padding: `${theme.spacing(0.25)} ${theme.spacing(1.5)}`,
    borderLeft: `3px solid ${theme.vars.palette.divider}`,
    color: theme.vars.palette.text.secondary,
  },
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
}: ChatMessageListProps) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // AC-39/40: auto-scroll engaged by default, disengages on user scroll-up
  const [autoScroll, setAutoScroll] = useState(true);

  // PROJ-17 Phase 4 Step 6: live streaming bubble state
  const streamingMessage = useAppSelector(
    (s) => s.chatBar.streamingAssistantMessage,
  );
  const showStreamingBubble =
    streamingMessage.isStreaming && streamingMessage.content !== '';

  const isAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance <= AUTO_SCROLL_THRESHOLD;
  }, []);

  // Track user scroll → toggle autoScroll based on bottom-proximity. We only
  // flip state when the value would actually change, otherwise streaming
  // chunks would loop the bottom-tracking effect at chunk-rate (50+/sec).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const atBottom = isAtBottom();
      setAutoScroll((prev) => (prev === atBottom ? prev : atBottom));
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [isAtBottom]);

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
        <ScrollContainer ref={scrollRef}>
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
    <Wrapper>
      <ScrollContainer ref={scrollRef}>
        {hasMore && (
          <Button
            size="small"
            onClick={onLoadMore}
            sx={{ alignSelf: 'center', mb: 0.5, textTransform: 'none', fontSize: '0.75rem' }}
          >
            {t('search.chat.loadMore')}
          </Button>
        )}

        {messages.map((msg) => {
          const role: 'user' | 'assistant' = msg.role === 'user' ? 'user' : 'assistant';
          const isWorkflow =
            msg.message_type === 'workflow_card' && msg.agent_session;

          return (
            <Box key={msg.id}>
              <MessageRow role={role}>
                {role === 'assistant' && !isWorkflow && (
                  <AssistantAvatar aria-hidden="true">
                    <AutoAwesomeIcon sx={{ fontSize: 16 }} />
                  </AssistantAvatar>
                )}

                {msg.role === 'user' ? (
                  <UserBubble>{msg.content}</UserBubble>
                ) : isWorkflow && msg.agent_session ? (
                  /* AC-42: Workflow-Card inline; takes full row width. */
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <WorkflowCard agentSessionRef={msg.agent_session} />
                  </Box>
                ) : (
                  <AssistantContent>
                    <AssistantBubble>
                      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                        {msg.content}
                      </Markdown>
                    </AssistantBubble>
                    {/* AC-38: Sources inline below AI bubble (Perplexity-style cards) */}
                    {msg.sources && msg.sources.length > 0 && (
                      <Stack gap={0.5}>
                        {msg.sources.map((src, idx) => (
                          <SourceCard
                            key={`${msg.id}-${src.url}-${idx}`}
                            source={src}
                            messageId={msg.id}
                            onSaveKeywords={onSaveKeywords}
                            onSaveNotes={onSaveNotes}
                          />
                        ))}
                      </Stack>
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
                  <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                    {streamingMessage.content}
                  </Markdown>
                  <TypingCursor aria-hidden="true" />
                </AssistantBubble>
                {streamingMessage.sources.length > 0 && (
                  <Stack gap={0.5}>
                    {streamingMessage.sources.map((src, idx) => (
                      <SourceCard
                        key={`stream-${src.url}-${idx}`}
                        source={src}
                        messageId={streamingMessage.id ?? 'streaming'}
                        onSaveKeywords={onSaveKeywords}
                        onSaveNotes={onSaveNotes}
                      />
                    ))}
                  </Stack>
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
          containerRef={scrollRef}
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
