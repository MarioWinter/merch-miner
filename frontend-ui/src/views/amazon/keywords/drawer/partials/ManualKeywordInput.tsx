import { useState, useCallback } from 'react';
import { Button, Stack, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useBulkAddKeywordsMutation } from '@/store/keywordSlice';

interface ManualKeywordInputProps {
  nicheId: string;
}

export const ManualKeywordInput = ({ nicheId }: ManualKeywordInputProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [value, setValue] = useState('');
  const [bulkAdd, { isLoading }] = useBulkAddKeywordsMutation();

  const handleAdd = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    // Support comma-separated batch input
    const keywords = trimmed
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
      .map((k) => ({ keyword: k.slice(0, 200), source: 'manual' as const }));

    if (keywords.length === 0) return;

    try {
      await bulkAdd({ nicheId, body: { keywords } }).unwrap();
      setValue('');
      enqueueSnackbar(
        t('keywords.addToNiche.addedCount', { count: keywords.length }),
        { variant: 'success' },
      );
    } catch {
      enqueueSnackbar(t('keywords.errors.addFailed'), { variant: 'error' });
    }
  }, [value, nicheId, bulkAdd, enqueueSnackbar, t]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        size="small"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('keywords.drawer.manualPlaceholder')}
        fullWidth
        disabled={isLoading}
      />
      <Button
        size="small"
        variant="contained"
        onClick={handleAdd}
        disabled={isLoading || !value.trim()}
        startIcon={<AddIcon sx={{ fontSize: 16 }} />}
        sx={{ whiteSpace: 'nowrap' }}
      >
        {t('keywords.drawer.addButton')}
      </Button>
    </Stack>
  );
};
