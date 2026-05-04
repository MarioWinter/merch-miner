import { Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { KeywordSource, SuggestionSource } from '../types';

type BadgeSource = KeywordSource | SuggestionSource;

const SOURCE_COLORS: Record<BadgeSource, 'primary' | 'warning' | 'info' | 'default' | 'success' | 'secondary'> = {
  research: 'primary',
  amazon_search: 'warning',
  web_search: 'info',
  manual: 'default',
  junglescout: 'success',
  listing: 'success',
  suggestion: 'primary',
  after: 'warning',
  before: 'info',
  synonym: 'secondary',
};

interface SourceBadgeProps {
  source: BadgeSource;
}

export const SourceBadge = ({ source }: SourceBadgeProps) => {
  const { t } = useTranslation();

  return (
    <Chip
      label={t(`keywords.source.${source}`)}
      color={SOURCE_COLORS[source] ?? 'default'}
      size="small"
      variant="outlined"
      sx={{ borderRadius: '6px', height: 22, fontSize: '0.75rem' }}
    />
  );
};
