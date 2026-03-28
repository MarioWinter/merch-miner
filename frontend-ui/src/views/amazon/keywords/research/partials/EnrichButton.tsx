import { Button, CircularProgress, IconButton, Tooltip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';

interface EnrichButtonProps {
  /** Single keyword enrich (row-level) */
  keyword?: string;
  /** Bulk keywords enrich */
  keywords?: string[];
  isEnriching: boolean;
  onEnrich: () => void;
  variant?: 'icon' | 'button';
}

export const EnrichButton = ({
  keyword,
  isEnriching,
  onEnrich,
  variant = 'icon',
}: EnrichButtonProps) => {
  const { t } = useTranslation();

  if (variant === 'icon') {
    return (
      <Tooltip title={t('keywords.enrich.buttonLabel')}>
        <span>
          <IconButton
            size="small"
            onClick={onEnrich}
            disabled={isEnriching}
            aria-label={t('keywords.enrich.buttonLabel')}
            sx={{ borderRadius: '8px' }}
          >
            {isEnriching ? (
              <CircularProgress size={16} />
            ) : (
              <AutoAwesomeIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={
        isEnriching ? <CircularProgress size={14} /> : <AutoAwesomeIcon sx={{ fontSize: 16 }} />
      }
      onClick={onEnrich}
      disabled={isEnriching}
    >
      {keyword
        ? t('keywords.enrich.buttonLabel')
        : t('keywords.enrich.bulkLabel')}
    </Button>
  );
};
