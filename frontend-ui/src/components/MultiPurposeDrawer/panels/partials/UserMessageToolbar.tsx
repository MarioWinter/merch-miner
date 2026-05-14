/**
 * PROJ-29 Phase 1J follow-up — hover-reveal action toolbar below the user
 * message bubble. Mirrors the visual language of `MessageActionToolbar`
 * (below the assistant bubble) so the chat UI feels symmetric.
 *
 * - Copy button always rendered.
 * - Retry button only rendered when the IMMEDIATELY-FOLLOWING message is a
 *   persisted assistant placeholder with `message_type === 'error'`. The
 *   handler re-sends the user's content via the existing `startStream`
 *   path — old user message + ErrorBubble stay in history as evidence.
 *
 * The toolbar's `opacity: 0 → 1` transition is driven by a `.is-hovered` CSS
 * class set by the parent `MessageRow` (CSS `:hover`); we never reach for
 * `useState` for hover because that would re-render the row on every
 * mouseenter/leave during scroll.
 */
import { useState } from 'react';
import { IconButton, Stack, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ReplayIcon from '@mui/icons-material/Replay';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';

interface UserMessageToolbarProps {
  /** User-message content — what Copy + Retry both operate on. */
  content: string;
  /** When provided, render the Retry icon. Parent decides visibility based
   *  on the next-message pairing (assistant + message_type === 'error'). */
  onRetry?: () => void;
}

/**
 * Bar lives BELOW the user bubble, right-aligned to mirror the assistant
 * toolbar (which sits below the assistant bubble, left-aligned). Hover
 * reveal is driven by the parent `MessageRow` — see ChatMessageList.tsx.
 */
const Bar = styled(Stack)(({ theme }) => ({
  marginTop: theme.spacing(0.5),
  paddingRight: theme.spacing(0.5),
  opacity: 0,
  transition: 'opacity 150ms ease',
  // Keep focusable buttons visible when keyboard-traversed; covers the
  // accessibility hole opened by opacity-only reveal.
  '&:focus-within': { opacity: 1 },
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

const UserMessageToolbar = ({ content, onRetry }: UserMessageToolbarProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        // Fallback for non-secure contexts — mirrors MessageActionToolbar.
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

  return (
    <Bar
      direction="row"
      gap={0.25}
      justifyContent="flex-end"
      className="user-msg-actions"
      role="toolbar"
      aria-label={t('search.actions.toolbarLabel')}
    >
      <Tooltip
        title={copied ? t('search.actions.copied') : t('search.chat.userBubble.copy')}
        placement="top"
      >
        <ToolbarButton
          size="small"
          onClick={handleCopy}
          aria-label={t('search.chat.userBubble.copy')}
        >
          {copied ? (
            <CheckIcon sx={{ fontSize: 16 }} />
          ) : (
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          )}
        </ToolbarButton>
      </Tooltip>

      {onRetry && (
        <Tooltip title={t('search.chat.userBubble.retry')} placement="top">
          <ToolbarButton
            size="small"
            onClick={onRetry}
            aria-label={t('search.chat.userBubble.retry')}
          >
            <ReplayIcon sx={{ fontSize: 16 }} />
          </ToolbarButton>
        </Tooltip>
      )}
    </Bar>
  );
};

export default UserMessageToolbar;
