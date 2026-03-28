import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useCreateIdeaMutation } from '@/store/ideaSlice';

interface ManualIdeaFormProps {
  nicheId: string;
}

const FormCard = styled(Box)(({ theme }) => ({
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: theme.spacing(2.5),
  background: 'rgba(11,39,49,0.40)',
  ...theme.applyStyles('light', {
    border: '1px solid rgba(7,30,38,0.08)',
    background: theme.vars.palette.background.paper,
  }),
}));

export const ManualIdeaForm = ({ nicheId }: ManualIdeaFormProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [text, setText] = useState('');
  const [createIdea, { isLoading }] = useCreateIdeaMutation();

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Support batch: one slogan per line
    const lines = trimmed
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    try {
      for (const line of lines) {
        await createIdea({
          nicheId,
          body: { slogan_text: line },
        }).unwrap();
      }
      enqueueSnackbar(
        t('ideas.notifications.createSuccess', { count: lines.length }),
        { variant: 'success' },
      );
      setText('');
    } catch {
      enqueueSnackbar(t('ideas.notifications.createError'), {
        variant: 'error',
      });
    }
  };

  return (
    <FormCard>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
        {t('ideas.newIdea')}
      </Typography>
      <Stack spacing={1.5}>
        <TextField
          multiline
          minRows={2}
          maxRows={6}
          placeholder={t('ideas.batchHint')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isLoading}
          slotProps={{
            input: { sx: { fontSize: '0.875rem' } },
          }}
          aria-label={t('ideas.newIdea')}
        />
        <Button
          variant="contained"
          size="small"
          startIcon={
            isLoading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <AddIcon />
            )
          }
          onClick={handleSubmit}
          disabled={isLoading || !text.trim()}
          sx={{ alignSelf: 'flex-end' }}
        >
          {t('ideas.newIdea')}
        </Button>
      </Stack>
    </FormCard>
  );
};
