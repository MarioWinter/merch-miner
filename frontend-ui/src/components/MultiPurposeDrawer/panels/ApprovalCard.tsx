import { Card, CardContent, Typography, Stack, Button, Chip, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useTranslation } from 'react-i18next';
import type { AgentMessage } from './AgentPanel/types';

const ApprovalRoot = styled(Card)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.warning.main}`,
  backgroundColor: `rgba(245, 158, 11, 0.06)`,
  borderRadius: theme.shape.borderRadius,
  maxWidth: '90%',
}));

interface ApprovalCardProps {
  message: AgentMessage;
  onApprove: (actionLogId: string) => void;
  onReject: (actionLogId: string) => void;
  approving: boolean;
  rejecting: boolean;
  /** Compact layout for inline use inside WorkflowCard (smaller paddings, full width). */
  compact?: boolean;
}

const ApprovalCard = ({
  message,
  onApprove,
  onReject,
  approving,
  rejecting,
  compact = false,
}: ApprovalCardProps) => {
  const { t } = useTranslation();

  // Extract action log ID from tool_calls or content
  const actionLogId =
    message.tool_calls[0]?.args?.action_log_id as string | undefined;

  if (!actionLogId) return null;

  const toolName = message.tool_calls[0]?.tool_name ?? '';
  const costEstimate = message.tool_calls[0]?.args?.cost_estimate as string | undefined;

  const padding = compact ? 1 : 1.5;

  return (
    <ApprovalRoot
      elevation={0}
      sx={compact ? { maxWidth: '100%' } : undefined}
      role="region"
      aria-label={t('agent.approval.title')}
    >
      <CardContent sx={{ p: padding, '&:last-child': { pb: padding } }}>
        <Stack gap={compact ? 0.75 : 1}>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <WarningAmberIcon color="warning" sx={{ fontSize: 16 }} />
            <Typography variant="subtitle2" color="warning.main" sx={{ fontSize: compact ? '0.75rem' : undefined }}>
              {t('agent.approval.title')}
            </Typography>
          </Stack>

          <Typography variant="body2" sx={{ fontSize: compact ? '0.75rem' : undefined }}>
            {message.content}
          </Typography>

          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            {toolName && (
              <Chip label={toolName} size="small" variant="outlined" />
            )}
            {costEstimate && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('agent.approval.cost')}: ~${costEstimate}
                </Typography>
              </Box>
            )}
          </Stack>

          <Stack direction="row" gap={1} justifyContent="flex-end">
            <Button
              size="small"
              variant="outlined"
              onClick={() => onReject(actionLogId)}
              disabled={rejecting}
            >
              {t('agent.approval.reject')}
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => onApprove(actionLogId)}
              disabled={approving}
            >
              {t('agent.approval.approve')}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </ApprovalRoot>
  );
};

export default ApprovalCard;
