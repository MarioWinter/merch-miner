import {
  Box,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import type { NicheSuggestion } from '../types';

interface NicheSuggestionListProps {
  suggestions: NicheSuggestion[];
  selectedIds: Set<string>;
  onToggle: (nicheId: string) => void;
  isLoading: boolean;
}

export const NicheSuggestionList = ({
  suggestions,
  selectedIds,
  onToggle,
  isLoading,
}: NicheSuggestionListProps) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <LinearProgress color="secondary" />;
  }

  if (suggestions.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled" sx={{ py: 2 }}>
        {t('ideas.adapt.noCompatible')}
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {suggestions.map((s) => {
        const isSelected = selectedIds.has(s.niche_id);
        const isDisabled = s.already_adapted;

        return (
          <Box
            key={s.niche_id}
            onClick={() => !isDisabled && onToggle(s.niche_id)}
            role="option"
            aria-selected={isSelected}
            aria-disabled={isDisabled}
            sx={(theme) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              borderRadius: 2,
              cursor: isDisabled ? 'default' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
              border: `1px solid ${
                isSelected
                  ? theme.vars.palette.secondary.main
                  : theme.vars.palette.divider
              }`,
              '&:hover': isDisabled
                ? {}
                : { borderColor: alpha(COLORS.white, 0.14) },
            })}
          >
            {/* Selection indicator */}
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: isSelected
                  ? 'none'
                  : `1px solid ${alpha(COLORS.white, 0.2)}`,
                bgcolor: isSelected ? 'secondary.main' : 'transparent',
              }}
            >
              {isSelected && (
                <CheckIcon sx={{ fontSize: 14, color: 'common.white' }} />
              )}
            </Box>

            {/* Niche info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {s.niche_name}
                </Typography>
                {isDisabled && (
                  <Chip
                    label={t('ideas.niche.alreadyAdapted')}
                    size="small"
                    variant="outlined"
                    sx={{
                      borderRadius: '6px',
                      fontSize: '0.625rem',
                      height: 18,
                    }}
                  />
                )}
              </Stack>
              {s.shared_patterns.length > 0 && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ mt: 0.5 }}
                  flexWrap="wrap"
                  useFlexGap
                >
                  {s.shared_patterns.map((p) => (
                    <Chip
                      key={p}
                      label={p}
                      size="small"
                      sx={{
                        borderRadius: '4px',
                        fontSize: '0.625rem',
                        height: 18,
                      }}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            {/* Score */}
            <Box sx={{ textAlign: 'right', minWidth: 60 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {s.compatibility_score}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={s.compatibility_score}
                color="secondary"
                sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
              />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
};
