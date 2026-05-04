import { Button, Chip, Stack } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import { useTranslation } from 'react-i18next';
import { EASING, DURATION } from '@/style/constants';

export interface RecentSearchEntry {
  keyword: string;
  marketplace: string;
}

interface SearchHistoryChipsProps {
  searches: RecentSearchEntry[];
  onSelect: (keyword: string, marketplace: string) => void;
  onRemove: (index: number) => void;
  onClearAll: () => void;
  /** i18n key namespace: defaults to `keywords.searchHistory`. Pass own
   *  namespace if you keep separate translations per view. */
  i18nNamespace?: string;
}

const HistoryChip = styled(Chip)(({ theme }) => ({
  borderRadius: 8,
  height: 28,
  fontSize: '0.8125rem',
  fontWeight: 500,
  background: alpha(theme.palette.text.primary, 0.04),
  border: `1px solid ${theme.vars.palette.divider}`,
  color: theme.vars.palette.text.secondary,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    background: alpha(theme.palette.text.primary, 0.08),
    borderColor: alpha(theme.palette.text.primary, 0.16),
    color: theme.vars.palette.text.primary,
  },
  '& .MuiChip-deleteIcon': {
    fontSize: 14,
    color: theme.vars.palette.text.disabled,
    transition: `color ${DURATION.fast}ms ${EASING.standard}`,
    '&:hover': {
      color: theme.vars.palette.error.main,
    },
  },
}));

export const SearchHistoryChips = ({
  searches,
  onSelect,
  onRemove,
  onClearAll,
  i18nNamespace = 'keywords.searchHistory',
}: SearchHistoryChipsProps) => {
  const { t } = useTranslation();

  if (searches.length === 0) return null;

  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{ flexWrap: 'wrap', gap: 0.75, mb: 2 }}
      role="list"
      aria-label={t(`${i18nNamespace}.label`)}
    >
      <HistoryIcon sx={{ fontSize: 16, color: 'text.disabled', mr: 0.25 }} />
      {searches.map((search, index) => (
        <HistoryChip
          key={`${search.keyword}-${search.marketplace}`}
          label={search.keyword}
          size="small"
          onClick={() => onSelect(search.keyword, search.marketplace)}
          onDelete={() => onRemove(index)}
          deleteIcon={<CloseIcon />}
          role="listitem"
        />
      ))}
      <Button
        size="small"
        variant="text"
        startIcon={<ClearAllIcon sx={{ fontSize: 14 }} />}
        onClick={onClearAll}
        sx={{
          color: 'text.disabled',
          fontSize: '0.75rem',
          textTransform: 'none',
          '&:hover': { color: 'text.secondary' },
        }}
      >
        {t(`${i18nNamespace}.clearAll`)}
      </Button>
    </Stack>
  );
};
