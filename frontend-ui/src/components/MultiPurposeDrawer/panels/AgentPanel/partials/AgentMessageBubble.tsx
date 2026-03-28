import { Stack, Typography, Box, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { AgentMessage } from '../types';

const BubbleRoot = styled(Box, {
  shouldForwardProp: (p) => p !== 'isUser',
})<{ isUser: boolean }>(({ theme, isUser }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: isUser ? 'flex-end' : 'flex-start',
  padding: theme.spacing(0.5, 0),
}));

const MessageCard = styled(Box, {
  shouldForwardProp: (p) => p !== 'isUser' && p !== 'isSystem',
})<{ isUser: boolean; isSystem: boolean }>(({ theme, isUser, isSystem }) => ({
  maxWidth: '85%',
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: isSystem
    ? 'transparent'
    : isUser
      ? `rgba(255, 90, 79, 0.12)`
      : theme.vars.palette.background.paper,
  border: isSystem
    ? `1px dashed ${theme.vars.palette.divider}`
    : `1px solid ${theme.vars.palette.divider}`,
  wordBreak: 'break-word',
}));

const SenderLabel = styled(Typography)({
  fontSize: '0.75rem',
  fontWeight: 600,
  lineHeight: 1.4,
});

const TimeLabel = styled(Typography)({
  fontSize: '0.6875rem',
  lineHeight: 1.4,
});

interface AgentMessageBubbleProps {
  message: AgentMessage;
}

const AgentMessageBubble = ({ message }: AgentMessageBubbleProps) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isApprovalResponse = message.role === 'approval_response';

  const senderDisplay = isUser
    ? ''
    : message.agent_avatar_emoji && message.agent_display_name
      ? `${message.agent_avatar_emoji} ${message.agent_display_name}`
      : message.agent_type || 'Agent';

  const timestamp = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <BubbleRoot isUser={isUser}>
      {!isUser && senderDisplay && (
        <SenderLabel color="text.secondary" sx={{ px: 0.5 }}>
          {senderDisplay}
        </SenderLabel>
      )}
      <MessageCard isUser={isUser} isSystem={isSystem}>
        {isApprovalResponse && (
          <Chip
            label={message.content.startsWith('Approved') ? 'Approved' : 'Rejected'}
            size="small"
            color={message.content.startsWith('Approved') ? 'success' : 'default'}
            sx={{ mb: 0.5 }}
          />
        )}
        <Typography variant="body2" color={isSystem ? 'text.secondary' : 'text.primary'}>
          {message.content}
        </Typography>
        {message.tool_calls.length > 0 && (
          <Stack gap={0.5} sx={{ mt: 0.5 }}>
            {message.tool_calls.map((tc, i) => (
              <Chip
                key={`${tc.tool_name}-${i}`}
                label={tc.tool_name}
                size="small"
                variant="outlined"
                sx={{ alignSelf: 'flex-start' }}
              />
            ))}
          </Stack>
        )}
      </MessageCard>
      <TimeLabel color="text.disabled" sx={{ px: 0.5 }}>
        {timestamp}
      </TimeLabel>
    </BubbleRoot>
  );
};

export default AgentMessageBubble;
