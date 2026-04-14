import { useCallback, useState } from 'react';
import { Autocomplete, Button, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';

interface KeywordSearchBarProps {
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  isSearching?: boolean;
}

export const KeywordSearchBar = ({
  value,
  suggestions,
  onChange,
  onSearch,
  isSearching = false,
}: KeywordSearchBarProps) => {
  const { t } = useTranslation();
  const [internalValue, setInternalValue] = useState(value);

  if (value !== internalValue && value !== '') {
    setInternalValue(value);
  }

  const handleInputChange = useCallback(
    (_: unknown, newValue: string) => {
      setInternalValue(newValue);
      onChange(newValue);
    },
    [onChange],
  );

  const handleSearch = useCallback(() => {
    const trimmed = internalValue.trim();
    if (trimmed) {
      onSearch(trimmed);
    }
  }, [internalValue, onSearch]);

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
    <>
      <Autocomplete
        freeSolo
        options={suggestions.slice(0, 10)}
        inputValue={internalValue}
        onInputChange={handleInputChange}
        onChange={(_, selected) => {
          if (typeof selected === 'string' && selected.trim()) {
            setInternalValue(selected);
            onChange(selected);
          }
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={t('keywords.page.searchPlaceholder')}
            variant="outlined"
            size="small"
            onKeyDown={handleKeyDown}
            slotProps={{
              input: {
                ...params.InputProps,
                startAdornment: (
                  <SearchIcon sx={{ fontSize: 20, color: 'text.secondary', mr: 1 }} />
                ),
              },
            }}
            aria-label={t('keywords.page.searchPlaceholder')}
          />
        )}
        sx={{ flex: 1, minWidth: 300 }}
      />

      <Button
        variant="contained"
        color="primary"
        startIcon={<SearchIcon />}
        onClick={handleSearch}
        disabled={!internalValue.trim() || isSearching}
        aria-label={t('keywords.page.searchButton')}
        sx={{ minWidth: 110 }}
      >
        {t('keywords.page.searchButton')}
      </Button>
    </>
  );
};
