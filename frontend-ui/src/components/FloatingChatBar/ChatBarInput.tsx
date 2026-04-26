import { useState, useRef, useEffect } from 'react';
import { IconButton, TextField, Stack, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import HealthStatusDot from '../MultiPurposeDrawer/HealthStatusDot';
import ModeDropdown from '../MultiPurposeDrawer/panels/ModeDropdown';

interface ChatBarInputProps {
  onSend: (message: string) => void;
  onDismiss: () => void;
  sending: boolean;
  disabled: boolean;
}

const InputRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  width: '100%',
}));

const ChatBarInput = ({ onSend, onDismiss, sending, disabled }: ChatBarInputProps) => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || sending || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onDismiss();
    }
  };

  return (
    <InputRow>
      <HealthStatusDot />
      <ModeDropdown compact />
      <TextField
        inputRef={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('search.chatBar.placeholder')}
        variant="outlined"
        size="small"
        fullWidth
        disabled={disabled}
        slotProps={{
          input: {
            sx: {
              borderRadius: '20px',
              bgcolor: 'background.sunken',
              fontSize: '0.875rem',
            },
          },
        }}
        aria-label={t('search.chatBar.placeholder')}
      />
      <IconButton
        onClick={handleSubmit}
        disabled={!value.trim() || sending || disabled}
        color="primary"
        size="small"
        aria-label={t('search.chatBar.send')}
      >
        {sending ? <CircularProgress size={18} /> : <SendIcon sx={{ fontSize: 20 }} />}
      </IconButton>
      <IconButton
        onClick={onDismiss}
        size="small"
        aria-label={t('search.chatBar.dismiss')}
        sx={{ color: 'text.secondary' }}
      >
        <CloseIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </InputRow>
  );
};

export default ChatBarInput;
