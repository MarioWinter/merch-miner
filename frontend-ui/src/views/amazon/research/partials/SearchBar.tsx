import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useGetSuggestionsQuery } from '../../../../store/researchSlice';
import type { Niche } from '../../../niches/list/types';

interface SearchBarProps {
  isLive: boolean;
  onToggleMode: () => void;
  keyword: string;
  marketplace: string;
  onKeywordChange: (keyword: string) => void;
  onSearch: (keyword: string) => void;
  /** The auto-detected niche matching the searched keyword (null if none). */
  matchedNiche: Niche | null;
  /** Whether a search has been submitted at least once. */
  hasSearched: boolean;
  /** Called when the niche indicator is clicked. */
  onNicheIndicatorClick: () => void;
  /** Whether a live search is currently running. */
  isSearching?: boolean;
  /** Called to cancel a running live search. */
  onCancel?: () => void;
  /** Called to save an autocomplete suggestion as a keyword (AC-21). */
  onSaveKeyword?: (keyword: string) => void;
  /** Keywords currently being saved (loading state per keyword). */
  savingKeywords?: Set<string>;
  /** Keywords already saved in this session (show check icon). */
  savedKeywords?: Set<string>;
  /**
   * Whether Search submission is allowed in DB mode without keyword.
   * When the parent has at least one filter active, this is true → empty-keyword search is allowed.
   * In Live mode the parent always passes false (Live needs a keyword).
   */
  allowEmptyKeyword?: boolean;
}

const ModeLabel = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ theme, active }) => ({
  fontSize: '0.8125rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  color: active
    ? theme.vars.palette.text.secondary
    : theme.vars.palette.text.disabled,
}));

const SearchBar = ({
  isLive,
  onToggleMode,
  keyword,
  marketplace,
  onKeywordChange,
  onSearch,
  matchedNiche,
  hasSearched,
  onNicheIndicatorClick,
  isSearching = false,
  onCancel,
  onSaveKeyword,
  savingKeywords = new Set<string>(),
  savedKeywords = new Set<string>(),
  allowEmptyKeyword = false,
}: SearchBarProps) => {
  const [inputValue, setInputValue] = useState(keyword);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    setInputValue(keyword);
  }, [keyword]);

  const handleInputChange = useCallback((_: unknown, value: string) => {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 300);
  }, []);

  const { data: suggestions = [] } = useGetSuggestionsQuery(
    { q: debouncedQuery, marketplace },
    { skip: debouncedQuery.length < 2 },
  );

  const canSubmit = inputValue.trim().length > 0 || allowEmptyKeyword;

  const handleSearch = useCallback(() => {
    if (!canSubmit) return;
    const trimmed = inputValue.trim();
    onKeywordChange(trimmed);
    onSearch(trimmed);
  }, [canSubmit, inputValue, onKeywordChange, onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch],
  );

  const nicheTooltip = matchedNiche
    ? `${matchedNiche.name} — Niche Pipeline`
    : 'Niche not saved';

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Stack direction="row" alignItems="center" spacing={1}>
          <Switch
            checked={isLive}
            onChange={onToggleMode}
            color="secondary"
            aria-label="Toggle research mode"
          />
          <ModeLabel active={isLive}>Live Research</ModeLabel>
        </Stack>

        <Autocomplete
          freeSolo
          fullWidth
          options={suggestions.slice(0, 10)}
          inputValue={inputValue}
          onInputChange={handleInputChange}
          onChange={(_, value) => {
            if (typeof value === 'string' && value.trim()) {
              setInputValue(value);
            }
          }}
          renderOption={(props, option) => {
            const { key, ...restProps } = props;
            return (
              <Box
                component="li"
                key={key}
                {...restProps}
                sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Typography variant="body2" sx={{ flex: 1 }}>{option}</Typography>
                {onSaveKeyword && matchedNiche && (
                  savedKeywords.has(option) ? (
                    <CheckCircleIcon
                      sx={{ fontSize: 18, color: 'success.main', ml: 1 }}
                    />
                  ) : (
                    <Tooltip title={`Save to ${matchedNiche.name}`}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSaveKeyword(option);
                        }}
                        disabled={savingKeywords.has(option)}
                        aria-label={`Save "${option}" to keyword bank`}
                        sx={{ ml: 1, p: 0.25 }}
                      >
                        {savingKeywords.has(option) ? (
                          <CircularProgress size={16} />
                        ) : (
                          <AddCircleOutlineIcon sx={{ fontSize: 18 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                  )
                )}
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search keywords..."
              size="small"
              onKeyDown={handleKeyDown}
              aria-label="Search keyword"
            />
          )}
          sx={{ flex: 1 }}
        />

        {hasSearched && (
          <Tooltip title={nicheTooltip}>
            <IconButton
              size="small"
              onClick={onNicheIndicatorClick}
              aria-label={nicheTooltip}
              sx={{ color: matchedNiche ? 'success.main' : 'text.disabled' }}
            >
              <Inventory2OutlinedIcon sx={{ fontSize: 22 }} />
            </IconButton>
          </Tooltip>
        )}

        {isSearching && onCancel ? (
          <Button
            variant="contained"
            color="error"
            startIcon={<StopCircleOutlinedIcon />}
            onClick={onCancel}
            aria-label="Stop search"
            sx={{ minWidth: 110 }}
          >
            Stop
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            disabled={!canSubmit}
            aria-label="Search"
            sx={{
              minWidth: 110,
              '&.Mui-disabled': {
                backgroundColor: (theme) => theme.vars.palette.primary.dark,
                color: (theme) => theme.vars.palette.primary.contrastText,
                opacity: 0.5,
              },
            }}
          >
            Search
          </Button>
        )}
      </Stack>

    </Stack>
  );
};

export default SearchBar;
