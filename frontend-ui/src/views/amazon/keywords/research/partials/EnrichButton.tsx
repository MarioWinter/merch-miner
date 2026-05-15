import { Button, CircularProgress, IconButton, Tooltip } from '@mui/material';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import { useTranslation } from 'react-i18next';
import { FEATURE_KEYS } from '@/constants/featureKeys';
import { useCan } from '@/hooks/useCan';

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
  const enrichEnabled = useCan(FEATURE_KEYS.KEYWORD_JUNGLESCOUT);

  const tooltipLabel = enrichEnabled
    ? t('keywords.enrich.buttonLabel')
    : t('keywords.enrich.disabledTooltip');
  const isDisabled = !enrichEnabled || isEnriching;

  if (variant === 'icon') {
    return (
      <Tooltip title={tooltipLabel}>
        <span>
          <IconButton
            size="small"
            onClick={onEnrich}
            disabled={isDisabled}
            aria-label={tooltipLabel}
            sx={{ borderRadius: '8px' }}
          >
            {isEnriching ? (
              <CircularProgress size={16} />
            ) : (
              <AutoGraphIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={tooltipLabel}>
      <span>
        <Button
          size="small"
          variant="outlined"
          startIcon={
            isEnriching ? <CircularProgress size={14} /> : <AutoGraphIcon sx={{ fontSize: 16 }} />
          }
          onClick={onEnrich}
          disabled={isDisabled}
        >
          {keyword
            ? t('keywords.enrich.buttonLabel')
            : t('keywords.enrich.bulkLabel')}
        </Button>
      </span>
    </Tooltip>
  );
};
