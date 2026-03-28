import { useRef, useEffect } from 'react';
import { Box, Button, Stack, Typography, Skeleton } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '@/types/search';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

const ScrollContainer = styled(Box)({
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
});

const UserBubble = styled(Box)(({ theme }) => ({
  alignSelf: 'flex-end',
  maxWidth: '85%',
  padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
  borderRadius: '12px 12px 4px 12px',
  backgroundColor: theme.vars.palette.primary.main,
  color: '#fff',
  fontSize: '0.8125rem',
  lineHeight: 1.55,
  wordBreak: 'break-word',
}));

const AssistantBubble = styled(Box)(({ theme }) => ({
  alignSelf: 'flex-start',
  maxWidth: '90%',
  padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
  borderRadius: '12px 12px 12px 4px',
  backgroundColor: alpha(theme.palette.background.paper, 0.8),
  border: `1px solid ${theme.vars.palette.divider}`,
  fontSize: '0.8125rem',
  lineHeight: 1.55,
  wordBreak: 'break-word',
  // Markdown styling
  '& p': { margin: `${theme.spacing(0.5)} 0` },
  '& a': { color: theme.vars.palette.secondary.main, textDecoration: 'underline' },
  '& code': {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '0.75rem',
    backgroundColor: alpha(theme.palette.common.black, 0.2),
    padding: '2px 4px',
    borderRadius: 4,
  },
  '& pre': {
    backgroundColor: alpha(theme.palette.common.black, 0.2),
    padding: theme.spacing(1),
    borderRadius: 8,
    overflowX: 'auto',
    '& code': { backgroundColor: 'transparent', padding: 0 },
  },
  '& ul, & ol': { paddingLeft: theme.spacing(2), margin: `${theme.spacing(0.5)} 0` },
  '& li': { marginBottom: theme.spacing(0.25) },
}));

const Timestamp = styled(Typography)({
  fontSize: '0.6875rem',
  textAlign: 'center',
  padding: '4px 0',
});

const ChatMessageList = ({ messages, isLoading, hasMore, onLoadMore }: ChatMessageListProps) => {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (isLoading && messages.length === 0) {
    return (
      <ScrollContainer sx={{ gap: 1.5, p: 2 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            width={i % 2 === 0 ? '60%' : '80%'}
            height={40}
            sx={{ alignSelf: i % 2 === 0 ? 'flex-end' : 'flex-start', borderRadius: 3 }}
          />
        ))}
      </ScrollContainer>
    );
  }

  if (messages.length === 0) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" gap={1} sx={{ py: 6 }}>
        <Typography variant="body2" color="text.secondary">
          {t('search.empty.firstSearchHint')}
        </Typography>
      </Stack>
    );
  }

  return (
    <ScrollContainer sx={{ gap: 1, p: 2 }}>
      {hasMore && (
        <Button
          size="small"
          onClick={onLoadMore}
          sx={{ alignSelf: 'center', mb: 1, textTransform: 'none', fontSize: '0.75rem' }}
        >
          {t('search.chat.loadMore')}
        </Button>
      )}

      {messages.map((msg) => (
        <Box key={msg.id}>
          {msg.role === 'user' ? (
            <UserBubble>{msg.content}</UserBubble>
          ) : (
            <AssistantBubble>
              <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
            </AssistantBubble>
          )}
          <Timestamp variant="caption" color="text.disabled">
            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Timestamp>
        </Box>
      ))}

      <div ref={bottomRef} />
    </ScrollContainer>
  );
};

export default ChatMessageList;
