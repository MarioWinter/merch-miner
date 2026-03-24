import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Autocomplete,
  Button,
  Chip,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { useGetSuggestionsQuery } from '../../../../store/researchSlice';
import type { RecentSearch } from '../hooks/useRecentSearches';

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
              onKeywordChange(value.trim());
              onSearch(value.trim());
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

        <Button
          variant="contained"
          color="primary"
          startIcon={<SearchIcon />}
          onClick={handleSearch}
          aria-label="Search"
          sx={{ minWidth: 110 }}
        >
          Search
        </Button>
      </Stack>

      {recentSearches.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {recentSearches.map((item, idx) => (
            <Chip
              key={`${item.keyword}-${item.marketplace}`}
              label={item.keyword}
              size="small"
              onClick={() => onRecentClick(item.keyword, item.marketplace)}
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
