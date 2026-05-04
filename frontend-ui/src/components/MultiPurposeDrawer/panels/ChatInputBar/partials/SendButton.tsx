/**
 * PROJ-20 Phase 3.6 — SendButton
 *
 * Round IconButton, primary color when enabled. Disabled while the input
 * is empty OR while a stream is in flight (the parent computes both).
 *
 * Phase 3.7 will wire the actual `onSubmit` flow (read SSE URL, append
 * `niche_id`, dispatch streaming reducers); for 3.6 we just expose the
 * disabled-state contract so empty-input behavior works in the live UI.
 */
import { IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import { useTranslation } from 'react-i18next';

export interface SendButtonProps {
  /** True while the SSE stream from a previous send is still running. */
  isStreaming?: boolean;
  /** True when the textarea has neither text nor a chip. */
  isEmpty?: boolean;
  /** Click handler invoked by the parent ChatInputBar. */
  onSubmit?: () => void;
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
  onSubmit,
}: SendButtonProps) => {
  const { t } = useTranslation();
  const disabled = isEmpty || isStreaming;
  return (
    <RoundSendButton
      size="small"
      disabled={disabled}
      onClick={() => {
        if (!disabled) onSubmit?.();
      }}
      data-testid="chat-input-send-button"
      data-disabled={disabled ? 'true' : 'false'}
      aria-label={t('search.chatBar.send')}
    >
      <SendIcon sx={{ fontSize: 18 }} />
    </RoundSendButton>
  );
};

export default SendButton;
