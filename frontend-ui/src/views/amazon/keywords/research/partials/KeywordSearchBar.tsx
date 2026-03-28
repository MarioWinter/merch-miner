import { Autocomplete, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';

interface KeywordSearchBarProps {
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
}

export const KeywordSearchBar = ({ value, suggestions, onChange }: KeywordSearchBarProps) => {
  const { t } = useTranslation();

  return (
    <Autocomplete
      freeSolo
      options={suggestions}
      inputValue={value}
      onInputChange={(_e, newValue) => onChange(newValue)}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={t('keywords.page.searchPlaceholder')}
          variant="outlined"
          size="small"
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: <SearchIcon sx={{ fontSize: 20, color: 'text.secondary', mr: 1 }} />,
            },
          }}
        />
      )}
      sx={{ flex: 1, minWidth: 300 }}
    />
  );
};
