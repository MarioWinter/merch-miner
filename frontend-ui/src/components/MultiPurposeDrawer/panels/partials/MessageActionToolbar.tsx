import { useState } from 'react';
import { Box, CircularProgress, IconButton, Stack, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ReplayIcon from '@mui/icons-material/Replay';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useCreateShareLinkMutation } from '@/store/searchSlice';

interface MessageActionToolbarProps {
  /** Persisted assistant message id — used for Regenerate's delete step. */
  messageId: string;
  /** Markdown source of the answer (Copy uses this verbatim per AC-34). */
  content: string;
  /** Active session id — required for Share + Regenerate. */
  sessionId: string;
  /** Toolbar fades in only after the message's own stream finished (AC-31). */
  isOwnMessageStreaming: boolean;
  /** Disables Regenerate while ANY stream is active (AC-32). */
  isAnyStreamActive: boolean;
  /** True when there is a prior user-message in the session that can be re-sent. */
  canRegenerate: boolean;
  /** Parent-owned: deletes this message and starts a new stream from prior user msg. */
  onRegenerate: () => void;
  /** Parent-owned: saves the markdown text to a niche (direct or via picker modal). */
  onSaveAnswer: () => void;
}

const Bar = styled(Stack)(({ theme }) => ({
  marginTop: theme.spacing(0.5),
  paddingLeft: theme.spacing(0.5),
  opacity: 0.85,
  transition: 'opacity 200ms ease',
  '&:hover': { opacity: 1 },
}));

const ToolbarButton = styled(IconButton)(({ theme }) => ({
  padding: theme.spacing(0.5),
  borderRadius: 6,
  color: theme.vars.palette.text.secondary,
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
    color: theme.vars.palette.text.primary,
  },
}));

const COPY_FEEDBACK_MS = 1500;

const MessageActionToolbar = ({
  messageId,
  content,
  sessionId,
  isOwnMessageStreaming,
  isAnyStreamActive,
  canRegenerate,
  onRegenerate,
  onSaveAnswer,
}: MessageActionToolbarProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [copied, setCopied] = useState(false);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [createShareLink, { isLoading: isCreatingShare }] =
    useCreateShareLinkMutation();

  if (isOwnMessageStreaming) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        // AC-34 fallback: hidden textarea + execCommand for non-secure ctx.
        const ta = document.createElement('textarea');
        ta.value = content;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        enqueueSnackbar(t('search.actions.copyFallbackWarning'), {
          variant: 'warning',
        });
      }
      setCopied(true);
      enqueueSnackbar(t('search.actions.copySuccess'), { variant: 'success' });
      window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      enqueueSnackbar(t('search.actions.copyError'), { variant: 'error' });
    }
  };

  const handleShare = async () => {
    try {
      const result = await createShareLink(sessionId).unwrap();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.public_url);
      }
      enqueueSnackbar(t('search.actions.shareSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('search.actions.shareError'), { variant: 'error' });
    }
  };

  // EC-9: idempotency wrapper around parent's save handler — `onSaveAnswer`
  // resolves synchronously (parent fires-and-forgets), so we only guard the
  // brief click window to defeat double-clicks.
  const handleSave = () => {
    if (savingAnswer) return;
    setSavingAnswer(true);
    try {
      onSaveAnswer();
    } finally {
      window.setTimeout(() => setSavingAnswer(false), 400);
    }
  };

  const regenerateDisabled = !canRegenerate || isAnyStreamActive;
  const regenerateTooltip = isAnyStreamActive
    ? t('search.actions.regenerateBusy')
    : !canRegenerate
      ? t('search.actions.regenerateUnavailable')
      : t('search.actions.regenerate');

  return (
    <Bar
      direction="row"
      gap={0.25}
      data-message-id={messageId}
      role="toolbar"
      aria-label={t('search.actions.toolbarLabel')}
    >
      <Tooltip
        title={copied ? t('search.actions.copied') : t('search.actions.copy')}
        placement="top"
      >
        <ToolbarButton
          size="small"
          onClick={handleCopy}
          aria-label={t('search.actions.copy')}
        >
          {copied ? (
            <CheckIcon sx={{ fontSize: 16 }} />
          ) : (
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          )}
        </ToolbarButton>
      </Tooltip>

      <Tooltip title={regenerateTooltip} placement="top">
        <Box component="span">
          <ToolbarButton
            size="small"
            onClick={onRegenerate}
            disabled={regenerateDisabled}
            aria-label={t('search.actions.regenerate')}
          >
            <ReplayIcon sx={{ fontSize: 16 }} />
          </ToolbarButton>
        </Box>
      </Tooltip>

      <Tooltip title={t('search.actions.share')} placement="top">
        <Box component="span">
          <ToolbarButton
            size="small"
            onClick={handleShare}
            disabled={isCreatingShare}
            aria-label={t('search.actions.share')}
          >
            {isCreatingShare ? (
              <CircularProgress size={14} />
            ) : (
              <ShareOutlinedIcon sx={{ fontSize: 16 }} />
            )}
          </ToolbarButton>
        </Box>
      </Tooltip>

      <Tooltip title={t('search.actions.save')} placement="top">
        <Box component="span">
          <ToolbarButton
            size="small"
            onClick={handleSave}
            disabled={savingAnswer}
            aria-label={t('search.actions.save')}
          >
            {savingAnswer ? (
              <CircularProgress size={14} />
            ) : (
              <BookmarkAddOutlinedIcon sx={{ fontSize: 16 }} />
            )}
          </ToolbarButton>
        </Box>
      </Tooltip>
    </Bar>
  );
};

export default MessageActionToolbar;
