import { Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { KeywordSource } from '../types';

const SOURCE_COLORS: Record<KeywordSource, 'primary' | 'warning' | 'info' | 'default' | 'success'> = {
  research: 'primary',
  amazon_search: 'warning',
  web_search: 'info',
  manual: 'default',
  junglescout: 'success',
};

interface SourceBadgeProps {
  source: KeywordSource;
}

export const SourceBadge = ({ source }: SourceBadgeProps) => {
  const { t } = useTranslation();

  return (
    <Chip
      label={t(`keywords.source.${source}`)}
      color={SOURCE_COLORS[source]}
      size="small"
      variant="outlined"
      sx={{ borderRadius: '6px', height: 22, fontSize: '0.75rem' }}
    />
  );
};
