import { useMemo } from 'react';
import { Stack, Typography } from '@mui/material';
import { EASING, DURATION } from '@/style/constants';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/SectionCard';
import { SectionLabel } from '@/components/SectionLabel';

const MAX_WORDS = 12;

interface WordSuggestionsProps {
  suggestions: string[];
  searchTerm: string;
  onWordClick: (word: string) => void;
}

const extractUniqueWords = (
  suggestions: string[],
  searchTerm: string,
): string[] => {
  const searchWords = new Set(
    searchTerm.toLowerCase().split(/\s+/).filter(Boolean),
  );
  const seen = new Set<string>();
  const words: string[] = [];

  for (const suggestion of suggestions) {
    for (const word of suggestion.toLowerCase().split(/\s+/)) {
      const cleaned = word.replace(/[^a-z0-9]/g, '');
      if (
        cleaned.length > 2 &&
        !searchWords.has(cleaned) &&
        !seen.has(cleaned)
      ) {
        seen.add(cleaned);
        words.push(cleaned);
        if (words.length >= MAX_WORDS) return words;
      }
    }
  }

  return words;
};

export const WordSuggestions = ({
  suggestions,
  searchTerm,
  onWordClick,
}: WordSuggestionsProps) => {
  const { t } = useTranslation();
  const words = useMemo(
    () => extractUniqueWords(suggestions, searchTerm),
    [suggestions, searchTerm],
  );

  if (words.length === 0) return null;

  return (
    <SectionCard sx={{ py: 1.5 }}>
      <SectionLabel
        icon={<TipsAndUpdatesIcon />}
        label={t('keywords.wordSuggestions.title')}
        iconColor="warning.main"
      />
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
        {words.map((word) => (
          <Typography
            key={word}
            component="span"
            variant="body2"
            onClick={() => onWordClick(word)}
            sx={{
              color: 'text.secondary',
              cursor: 'pointer',
              transition: `color ${DURATION.fast}ms ${EASING.standard}`,
              '&:hover': {
                color: 'secondary.main',
                textDecoration: 'underline',
              },
            }}
          >
            {word}
          </Typography>
        ))}
      </Stack>
    </SectionCard>
  );
};
