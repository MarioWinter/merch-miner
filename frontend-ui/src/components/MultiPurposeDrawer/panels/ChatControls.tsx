import { Chip, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setSearchMode, setSearchSources, setSelectedModel } from '@/store/chatBarSlice';
import type { SearchMode, SearchSource } from '@/types/search';

const MODELS = [
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'mistral-medium-latest', label: 'Mistral Medium' },
];

const MODES: { value: SearchMode; label: string }[] = [
  { value: 'speed', label: 'search.chat.modeSpeed' },
  { value: 'balanced', label: 'search.chat.modeBalanced' },
  { value: 'quality', label: 'search.chat.modeQuality' },
];

const ALL_SOURCES: SearchSource[] = ['web', 'academic', 'discussions'];

const ModeGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButton-root': {
    textTransform: 'none',
    fontSize: '0.75rem',
    fontWeight: 500,
    padding: `${theme.spacing(0.25)} ${theme.spacing(1)}`,
    border: 'none',
    borderRadius: `${theme.shape.borderRadius}px !important`,
    color: theme.vars.palette.text.secondary,
    '&.Mui-selected': {
      color: theme.vars.palette.primary.main,
      backgroundColor: 'rgba(255, 90, 79, 0.12)',
    },
  },
}));

const ChatControls = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { searchMode, searchSources, selectedModel } = useAppSelector((s) => s.chatBar);

  const handleModeChange = (_: React.MouseEvent<HTMLElement>, val: SearchMode | null) => {
    if (val) dispatch(setSearchMode(val));
  };

  const toggleSource = (source: SearchSource) => {
    const next = searchSources.includes(source)
      ? searchSources.filter((s) => s !== source)
      : [...searchSources, source];
    // Keep at least one source
    if (next.length > 0) dispatch(setSearchSources(next));
  };

  return (
    <Stack gap={1.5}>
      {/* Model picker */}
      <TextField
        select
        size="small"
        value={selectedModel}
        onChange={(e) => dispatch(setSelectedModel(e.target.value))}
        label={t('search.chat.model')}
        slotProps={{ input: { sx: { fontSize: '0.8125rem' } } }}
      >
        {MODELS.map((m) => (
          <MenuItem key={m.value} value={m.value} sx={{ fontSize: '0.8125rem' }}>
            {m.label}
          </MenuItem>
        ))}
      </TextField>

      {/* Search mode */}
      <Stack direction="row" alignItems="center" gap={1}>
        <Typography variant="caption" color="text.secondary">
          {t('search.chat.mode')}
        </Typography>
        <ModeGroup value={searchMode} exclusive onChange={handleModeChange} size="small">
          {MODES.map((m) => (
            <ToggleButton key={m.value} value={m.value}>
              {t(m.label)}
            </ToggleButton>
          ))}
        </ModeGroup>
      </Stack>

      {/* Source toggles */}
      <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          {t('search.chat.sources')}
        </Typography>
        {ALL_SOURCES.map((source) => (
          <Chip
            key={source}
            label={t(`search.chat.source_${source}`)}
            size="small"
            color={searchSources.includes(source) ? 'primary' : 'default'}
            variant={searchSources.includes(source) ? 'filled' : 'outlined'}
            onClick={() => toggleSource(source)}
            sx={{ fontSize: '0.75rem' }}
          />
        ))}
      </Stack>
    </Stack>
  );
};

export default ChatControls;
