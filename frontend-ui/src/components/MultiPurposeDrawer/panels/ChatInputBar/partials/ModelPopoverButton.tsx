/**
 * PROJ-20 Phase 3.6 — ModelPopoverButton
 *
 * Replaces the Phase 3.1 stub. Opens a Popover with a search field and a
 * provider-grouped list of models. The currently-selected model gets a
 * trailing checkmark; clicking a row dispatches `setSelectedModel` and
 * closes the popover.
 */
import { useMemo, useState, type MouseEvent } from 'react';
import {
  Box,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import MemoryIcon from '@mui/icons-material/Memory';
import SearchIcon from '@mui/icons-material/Search';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setSelectedModel } from '@/store/chatBarSlice';
import {
  MODELS,
  groupModelsByProvider,
  type ModelEntry,
} from '../utils/modelRegistry';

const PopoverInner = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  padding: theme.spacing(1),
  minWidth: 280,
  maxWidth: 320,
  maxHeight: 360,
}));

const ProviderHeader = styled(Typography)(({ theme }) => ({
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: theme.vars.palette.text.secondary,
  padding: theme.spacing(0.75, 1, 0.25),
}));

interface RowProps {
  selected: boolean;
}

const ModelRow = styled(ListItemButton, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<RowProps>(({ theme, selected }) => ({
  borderRadius: 8,
  paddingTop: theme.spacing(0.5),
  paddingBottom: theme.spacing(0.5),
  ...(selected && {
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.16),
    },
  }),
}));

const PROVIDER_LABEL_KEYS: Record<ModelEntry['provider'], string> = {
  OpenRouter: 'search.chatBar.modelPopover.providerOpenrouter',
};

const ModelPopoverButton = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const selectedModel = useAppSelector((s) => s.chatBar.selectedModel);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const [query, setQuery] = useState('');

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? MODELS.filter((m) => m.label.toLowerCase().includes(q))
      : MODELS;
    return groupModelsByProvider(filtered);
  }, [query]);

  const handleClose = () => {
    setAnchorEl(null);
    // Reset filter on close so the next open shows the full list.
    setQuery('');
  };

  const handleSelect = (value: string) => {
    dispatch(setSelectedModel(value));
    handleClose();
  };

  const activeLabel =
    MODELS.find((m) => m.value === selectedModel)?.label ?? selectedModel;

  return (
    <>
      <Tooltip title={t('search.chatBar.model')}>
        <IconButton
          size="small"
          onClick={handleOpen}
          data-testid="chat-input-model-button"
          aria-label={t('search.chatBar.modelPopover.ariaLabel')}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <MemoryIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          paper: {
            'data-testid': 'chat-input-model-popover',
            sx: { mt: -0.5, borderRadius: 2 },
          },
        }}
      >
        <PopoverInner>
          <TextField
            size="small"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.chatBar.modelPopover.searchPlaceholder')}
            autoFocus
            inputProps={{
              'aria-label': t('search.chatBar.modelPopover.searchPlaceholder'),
              'data-testid': 'chat-input-model-search',
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18 }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Box sx={{ overflowY: 'auto', flex: 1 }}>
            {filteredGroups.length === 0 ? (
              <Typography
                variant="body2"
                sx={{
                  p: 1.5,
                  color: 'text.secondary',
                  textAlign: 'center',
                }}
                data-testid="chat-input-model-empty"
              >
                {t('search.chatBar.modelPopover.noResults', { query })}
              </Typography>
            ) : (
              filteredGroups.map(({ provider, entries }) => (
                <Box
                  key={provider}
                  data-testid={`chat-input-model-group-${provider}`}
                >
                  <ProviderHeader>
                    {t(PROVIDER_LABEL_KEYS[provider])}
                  </ProviderHeader>
                  <List dense disablePadding>
                    {entries.map((m) => {
                      const selected = m.value === selectedModel;
                      return (
                        <ModelRow
                          key={m.value}
                          selected={selected}
                          onClick={() => handleSelect(m.value)}
                          data-testid={`chat-input-model-row-${m.value}`}
                          aria-pressed={selected}
                        >
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <MemoryIcon
                              sx={(theme) => ({
                                fontSize: 18,
                                color: selected
                                  ? theme.vars.palette.primary.main
                                  : theme.vars.palette.text.secondary,
                              })}
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={m.label}
                            primaryTypographyProps={{
                              variant: 'body2',
                              sx: { fontWeight: selected ? 600 : 500 },
                            }}
                          />
                          {selected && (
                            <CheckIcon
                              data-testid={`chat-input-model-check-${m.value}`}
                              sx={(theme) => ({
                                fontSize: 16,
                                color: theme.vars.palette.primary.main,
                              })}
                            />
                          )}
                        </ModelRow>
                      );
                    })}
                  </List>
                </Box>
              ))
            )}
          </Box>
          {/* visually-hidden helper showing current selection for screen readers */}
          <Box sx={{ position: 'absolute', left: -9999, top: -9999 }} aria-live="polite">
            {activeLabel}
          </Box>
        </PopoverInner>
      </Popover>
    </>
  );
};

export default ModelPopoverButton;
