import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Autocomplete,
  Button,
  Chip,
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
import CloseIcon from '@mui/icons-material/Close';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { useGetSuggestionsQuery } from '../../../../store/researchSlice';
import type { RecentSearch } from '../hooks/useRecentSearches';
import type { Niche } from '../../../niches/list/types';

interface SearchBarProps {
  isLive: boolean;
  onToggleMode: () => void;
  keyword: string;
  marketplace: string;
  onKeywordChange: (keyword: string) => void;
  onSearch: (keyword: string) => void;
  recentSearches: RecentSearch[];
  onRecentClick: (keyword: string, marketplace: string) => void;
  onRecentRemove: (index: number) => void;
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
}

const ModeLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.8125rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  color: theme.vars.palette.text.secondary,
}));

const SearchBar = ({
  isLive,
  onToggleMode,
  keyword,
  marketplace,
  onKeywordChange,
  onSearch,
  recentSearches,
  onRecentClick,
  onRecentRemove,
  matchedNiche,
  hasSearched,
  onNicheIndicatorClick,
  isSearching = false,
  onCancel,
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

  const handleSearch = useCallback(() => {
    if (inputValue.trim()) {
      onKeywordChange(inputValue.trim());
      onSearch(inputValue.trim());
    }
  }, [inputValue, onKeywordChange, onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch],
  );

  const handleRecentChipClick = useCallback(
    (kw: string, mp: string) => {
      // Only fill the input — do NOT trigger search
      setInputValue(kw);
      onRecentClick(kw, mp);
    },
    [onRecentClick],
  );

  const nicheTooltip = matchedNiche
    ? `${matchedNiche.name} — Open Niche Drawer`
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
          {isLive && <ModeLabel>Live Research</ModeLabel>}
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
            disabled={!inputValue.trim()}
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

      {recentSearches.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {recentSearches.map((item, idx) => (
            <Chip
              key={`${item.keyword}-${item.marketplace}`}
              label={item.keyword}
              size="small"
              onClick={() => handleRecentChipClick(item.keyword, item.marketplace)}
              onDelete={() => onRecentRemove(idx)}
              deleteIcon={<CloseIcon sx={{ fontSize: 14 }} />}
              variant="outlined"
              aria-label={`Recent search: ${item.keyword}`}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export default SearchBar;
