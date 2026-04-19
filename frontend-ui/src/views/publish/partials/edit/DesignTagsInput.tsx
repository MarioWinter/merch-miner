import { useState, type KeyboardEvent } from 'react';
import { Box, Chip, TextField, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

interface DesignTagsInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  max?: number;
}

const TagRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(0.5),
  marginTop: theme.spacing(0.5),
}));

const HeaderRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

const DesignTagsInput = ({ tags, onChange, max = 3 }: DesignTagsInputProps) => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed || tags.includes(trimmed) || tags.length >= max) {
      setInput('');
      return;
    }
    onChange([...tags, trimmed]);
    setInput('');
  };

  const handleRemove = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      handleRemove(tags[tags.length - 1]);
    }
  };

  const atLimit = tags.length >= max;

  return (
    <Box>
      <HeaderRow>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {t('publish.edit.thumbnails.tagsLabel')}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {t('publish.edit.thumbnails.tagsCounter', { count: tags.length, max })}
        </Typography>
      </HeaderRow>
      <TextField
        size="small"
        fullWidth
        placeholder={atLimit ? '' : t('publish.edit.thumbnails.tagsPlaceholder')}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleAdd}
        disabled={atLimit}
        sx={{ mt: 0.5 }}
      />
      {tags.length > 0 ? (
        <TagRow>
          {tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              variant="outlined"
              onDelete={() => handleRemove(tag)}
              aria-label={t('publish.edit.thumbnails.remove')}
            />
          ))}
        </TagRow>
      ) : null}
    </Box>
  );
};

export default DesignTagsInput;
