import { useRef, useEffect, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import { useListNichesQuery } from '@/store/nicheSlice';
import type { UseIdeaInlineAddReturn } from '../hooks/useInlineAdd';

interface InlineAddBarProps {
  inlineAdd: UseIdeaInlineAddReturn;
}

const BarRoot = styled(Box)(({ theme }) => ({
  borderRadius: 12,
  border: `1px solid ${theme.vars.palette.divider}`,
  background: alpha(COLORS.inkPaper, 0.60),
  backdropFilter: 'blur(8px)',
  transition: 'border-color 150ms ease',
  ...theme.applyStyles('light', {
    background: alpha(COLORS.white, 0.70),
    backdropFilter: 'blur(8px)',
  }),
}));

const InactiveRow = styled(Stack)(({ theme }) => ({
  padding: `${theme.spacing(1.5)} ${theme.spacing(2)}`,
  cursor: 'pointer',
  alignItems: 'center',
  gap: theme.spacing(1),
  '&:hover': {
    backgroundColor: alpha(COLORS.white, 0.02),
    ...theme.applyStyles('light', {
      backgroundColor: alpha(COLORS.ink, 0.02),
    }),
  },
}));

const ActiveRow = styled(Stack)(({ theme }) => ({
  padding: theme.spacing(2),
  gap: theme.spacing(1.5),
}));

const ActiveInput = ({
  error,
  isCreating,
  onSubmit,
  onCancel,
}: {
  error: string | null;
  isCreating: boolean;
  onSubmit: (text: string, nicheId?: string | null) => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [selectedNicheId, setSelectedNicheId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: nichesData } = useListNichesQuery({ page_size: 100 });
  const niches = nichesData?.results ?? [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) onSubmit(text, selectedNicheId);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <ActiveRow>
      <TextField
        inputRef={inputRef}
        multiline
        minRows={2}
        maxRows={6}
        fullWidth
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('ideas.inlineAdd.placeholder')}
        error={Boolean(error)}
        helperText={error ?? t('ideas.inlineAdd.batchHint')}
        disabled={isCreating}
        slotProps={{
          input: {
            'aria-label': t('ideas.inlineAdd.placeholder'),
          },
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            fontSize: '0.875rem',
          },
        }}
      />
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Autocomplete
          size="small"
          options={niches}
          getOptionLabel={(option) => option.name}
          onChange={(_e, val) => setSelectedNicheId(val?.id ?? null)}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={t('ideas.filter.allNiches')}
              slotProps={{
                input: {
                  ...params.InputProps,
                  'aria-label': t('ideas.filter.allNiches'),
                },
              }}
            />
          )}
          sx={{ width: 200 }}
        />
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onCancel} aria-label={t('ideas.adapt.cancel')}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <Button
          variant="contained"
          size="small"
          onClick={() => onSubmit(text, selectedNicheId)}
          disabled={isCreating || !text.trim()}
          startIcon={
            isCreating ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <AddIcon sx={{ fontSize: 18 }} />
            )
          }
        >
          {t('ideas.newIdea')}
        </Button>
      </Stack>
    </ActiveRow>
  );
};

export const InlineAddBar = ({ inlineAdd }: InlineAddBarProps) => {
  const { t } = useTranslation();
  const { isActive, isCreating, error, activate, cancel, submit } = inlineAdd;

  if (!isActive) {
    return (
      <BarRoot>
        <InactiveRow
          direction="row"
          onClick={activate}
          role="button"
          aria-label={t('ideas.inlineAdd.placeholder')}
        >
          <AddIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
          <Typography variant="body2" color="text.disabled">
            {t('ideas.inlineAdd.placeholder')}
          </Typography>
        </InactiveRow>
      </BarRoot>
    );
  }

  return (
    <BarRoot>
      <ActiveInput
        key="add-input"
        error={error}
        isCreating={isCreating}
        onSubmit={(text, nicheId) => void submit(text, nicheId)}
        onCancel={cancel}
      />
    </BarRoot>
  );
};
