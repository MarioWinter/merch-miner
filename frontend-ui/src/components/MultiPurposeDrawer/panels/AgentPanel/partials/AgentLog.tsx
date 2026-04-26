import { useRef, useEffect, useCallback, useState } from 'react';
import { Box, Button, Stack, Typography, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { AgentMessage } from '../types';
import AgentMessageBubble from './AgentMessageBubble';
import ApprovalCard from '../../ApprovalCard';

const LogContainer = styled(Box)({
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
});

const MessageList = styled(Stack)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  gap: theme.spacing(0.5),
}));

const PAGE_SIZE = 50;

interface AgentLogProps {
  messages: AgentMessage[];
  loading: boolean;
  onApprove: (actionLogId: string) => void;
  onReject: (actionLogId: string) => void;
  approving: boolean;
  rejecting: boolean;
}

const AgentLog = ({
  messages,
  loading,
  onApprove,
  onReject,
  approving,
  rejecting,
}: AgentLogProps) => {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  }, []);

  if (loading) {
    return (
      <LogContainer>
        <MessageList>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={48} />
          ))}
        </MessageList>
      </LogContainer>
    );
  }

  if (messages.length === 0) {
    return (
      <LogContainer sx={{ justifyContent: 'center', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {t('agent.log.empty')}
        </Typography>
      </LogContainer>
    );
  }

  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const hasMore = sorted.length > visibleCount;
  const visible = hasMore ? sorted.slice(sorted.length - visibleCount) : sorted;

  return (
    <LogContainer>
      <MessageList>
        {hasMore && (
          <Button size="small" onClick={handleLoadMore} sx={{ alignSelf: 'center' }}>
            {t('agent.log.loadMore')}
          </Button>
        )}
        {visible.map((msg) =>
          msg.role === 'approval_request' ? (
            <ApprovalCard
              key={msg.id}
              message={msg}
              onApprove={onApprove}
              onReject={onReject}
              approving={approving}
              rejecting={rejecting}
            />
          ) : (
            <AgentMessageBubble key={msg.id} message={msg} />
          ),
        )}
        <div ref={bottomRef} />
      </MessageList>
    </LogContainer>
  );
};

export default AgentLog;
