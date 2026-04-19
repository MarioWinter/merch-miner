import { useCallback, useState } from 'react';
import {
  Box,
  Chip,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { Controller, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { MbaListingFormValues } from '../../schemas/mbaListingSchema';
import { MBA_LISTING_CHAR_LIMITS } from '../../schemas/mbaListingSchema';
import SectionHeader from './SectionHeader';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const ChipsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  padding: theme.spacing(1),
  borderRadius: 8,
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  minHeight: 44,
}));

const KeywordChip = styled(Chip)(({ theme }) => ({
  height: 26,
  borderRadius: 6,
  backgroundColor: alpha(theme.palette.common.white, 0.08),
  color: theme.vars.palette.text.primary,
  '& .MuiChip-label': {
    ...theme.typography.caption,
    paddingInline: theme.spacing(1),
  },
  '& .MuiChip-deleteIcon': {
    color: theme.vars.palette.text.disabled,
    '&:hover': { color: theme.vars.palette.text.primary },
  },
}));

const InlineInput = styled(TextField)(({ theme }) => ({
  flex: '0 1 auto',
  minWidth: 80,
  '& .MuiOutlinedInput-root': {
    backgroundColor: 'transparent',
    borderRadius: 6,
    paddingBlock: 0,
    paddingInline: theme.spacing(0.5),
    ...theme.typography.caption,
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'transparent',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.vars.palette.divider,
  },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: COLORS.cyan,
  },
}));

type CounterSeverity = 'normal' | 'amber' | 'red';

const CharCounter = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'severity',
})<{ severity: CounterSeverity }>(({ theme, severity }) => ({
  color:
    severity === 'red'
      ? theme.vars.palette.error.main
      : severity === 'amber'
        ? COLORS.warningDk
        : theme.vars.palette.text.disabled,
  transition: `color ${DURATION.fast}ms ${EASING.standard}`,
}));

const FooterLinks = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  marginTop: theme.spacing(0.5),
}));

const CyanLink = styled(Link)(({ theme }) => ({
  ...theme.typography.caption,
  color: COLORS.cyan,
  cursor: 'pointer',
  textDecorationColor: alpha(COLORS.cyan, 0.4),
  '&:hover': {
    color: COLORS.cyanLt,
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getSeverity = (length: number, max: number): CounterSeverity => {
  if (length >= max) return 'red';
  if (length >= Math.floor(max * 0.9)) return 'amber';
  return 'normal';
};

const joinedLength = (items: string[]): number => items.join(', ').length;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KeywordChipsFieldProps {
  name: 'backend_keywords';
  control: Control<MbaListingFormValues>;
  maxLength?: number;
  context?: string;
  onOptionsClick?: (context: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const KeywordChipsField = ({
  name,
  control,
  maxLength = MBA_LISTING_CHAR_LIMITS.backend_keywords,
  context = 'keywords',
  onOptionsClick,
}: KeywordChipsFieldProps) => {
  const { t } = useTranslation();
  const [pending, setPending] = useState('');

  const handleKwFinder = useCallback(() => {
    // PROJ-10 wiring deferred — log for D5 stub
    console.log('[KeywordChipsField] open KW Finder');
  }, []);

  const handleKwWorkbench = useCallback(() => {
    console.log('[KeywordChipsField] open KW Workbench');
  }, []);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const chips: string[] = field.value ?? [];
        const length = joinedLength(chips);
        const severity = getSeverity(length, maxLength);

        const commitPending = () => {
          const trimmed = pending.trim();
          if (!trimmed) return;
          // Comma-separated paste support
          const parts = trimmed
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          if (parts.length === 0) return;
          const next = [...chips, ...parts];
          // Only commit if within limit; otherwise keep text in input for user to edit
          if (joinedLength(next) <= maxLength) {
            field.onChange(next);
            setPending('');
          }
        };

        const handleRemove = (idx: number) => {
          const next = chips.filter((_, i) => i !== idx);
          field.onChange(next);
        };

        return (
          <Box>
            <SectionHeader
              title={t('publish.edit.keywords.title', {
                defaultValue: 'Backend Keywords',
              })}
              infoTooltip={t('publish.edit.keywords.info', {
                defaultValue:
                  'Search terms used by Amazon indexing. Max 500 chars incl. separators.',
              })}
              context={context}
              onOptionsClick={onOptionsClick}
            />

            <ChipsContainer>
              {chips.map((kw, idx) => (
                <KeywordChip
                  key={`${kw}-${idx}`}
                  label={kw}
                  size="small"
                  onDelete={() => handleRemove(idx)}
                  aria-label={t('publish.edit.keywords.remove', {
                    defaultValue: 'Remove keyword {{kw}}',
                    kw,
                  })}
                />
              ))}
              <InlineInput
                size="small"
                variant="outlined"
                placeholder={t('publish.edit.keywords.addPlaceholder', {
                  defaultValue: '+ Add',
                })}
                value={pending}
                onChange={(e) => setPending(e.target.value)}
                onBlur={commitPending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    commitPending();
                  } else if (e.key === 'Backspace' && !pending && chips.length) {
                    handleRemove(chips.length - 1);
                  }
                }}
                aria-label={t('publish.edit.keywords.addAria', {
                  defaultValue: 'Add keyword',
                })}
              />
            </ChipsContainer>

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mt: 0.75 }}
            >
              <FooterLinks>
                <CyanLink onClick={handleKwFinder}>
                  {t('publish.edit.keywords.kwFinder', {
                    defaultValue: 'KW Finder',
                  })}
                </CyanLink>
                <CyanLink onClick={handleKwWorkbench}>
                  {t('publish.edit.keywords.kwWorkbench', {
                    defaultValue: 'KW Workbench',
                  })}
                </CyanLink>
              </FooterLinks>
              <CharCounter variant="caption" severity={severity}>
                {length}/{maxLength}
              </CharCounter>
            </Stack>

            {error?.message && (
              <Typography
                variant="caption"
                color="error.main"
                sx={{ display: 'block', mt: 0.5 }}
              >
                {error.message}
              </Typography>
            )}
          </Box>
        );
      }}
    />
  );
};

export default KeywordChipsField;
