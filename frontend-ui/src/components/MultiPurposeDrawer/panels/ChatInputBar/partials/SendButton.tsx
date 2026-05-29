/**
 * PROJ-20 Phase 3.6 — SendButton
 *
 * Round IconButton, primary color when enabled. Disabled while the input
 * is empty OR while another gating flag is set.
 *
 * FIX (Item 3, Phase 2): when a stream is in flight, the button swaps to a
 * Stop icon and clicking it invokes `onStop` instead of `onSubmit`. Same
 * bounding box, no CSS transition on the icon swap (straight swap).
 */
import { memo } from 'react';
import { IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import { useTranslation } from 'react-i18next';

export interface SendButtonProps {
  /** True while the SSE stream is active. Drives Send → Stop icon swap. */
  isStreaming?: boolean;
  /** True when the textarea has neither text nor a chip. */
  isEmpty?: boolean;
  /**
   * Additional gating that disables the Send action (e.g. in-flight upload,
   * parent-level `disabled`, initial POST-to-stream window). Ignored while
   * `isStreaming` is true so the Stop action is always clickable.
   */
  disabled?: boolean;
  /** Click handler invoked by the parent ChatInputBar on Send (not streaming). */
  onSubmit?: () => void;
  /** Click handler invoked while streaming — aborts the active stream. */
  onStop?: () => void;
}

const RoundSendButton = styled(IconButton)(({ theme }) => ({
  width: 36,
  height: 36,
  backgroundColor: theme.vars.palette.primary.main,
  color: theme.vars.palette.primary.contrastText,
  borderRadius: '50%',
  '&:hover': {
    backgroundColor: theme.vars.palette.primary.dark,
  },
  '&.Mui-disabled': {
    backgroundColor: theme.vars.palette.action.disabledBackground,
    color: theme.vars.palette.action.disabled,
  },
}));

const SendButton = ({
  isStreaming = false,
  isEmpty = true,
  disabled = false,
  onSubmit,
  onStop,
}: SendButtonProps) => {
  const { t } = useTranslation();
  // While streaming the button is always clickable (it's the Stop affordance).
  // Outside streaming, fall back to the existing empty/disabled gating.
  const buttonDisabled = isStreaming ? false : isEmpty || disabled;
  const ariaLabel = isStreaming
    ? t('search.stop.aria')
    : t('search.chatBar.send');
  const handleClick = () => {
    if (isStreaming) {
      onStop?.();
      return;
    }
    if (!buttonDisabled) onSubmit?.();
  };
  return (
    <RoundSendButton
      size="small"
      disabled={buttonDisabled}
      onClick={handleClick}
      data-testid="chat-input-send-button"
      data-disabled={buttonDisabled ? 'true' : 'false'}
      data-mode={isStreaming ? 'stop' : 'send'}
      aria-label={ariaLabel}
    >
      {isStreaming ? (
        <StopIcon sx={{ fontSize: 18 }} />
      ) : (
        <SendIcon sx={{ fontSize: 18 }} />
      )}
    </RoundSendButton>
  );
};

// Memo: props are primitives + stable useCallback handlers from
// ChatInputBar, so default shallow-compare is sufficient.
export default memo(SendButton);
