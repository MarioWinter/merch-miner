import { useCallback } from 'react';
import {
  Box,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import {
  MBA_LANGUAGES,
  type MbaListingLanguage,
} from '../../schemas/mbaListingSchema';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

// styled('section') keeps the semantic tag without going through Stack's
// `component` prop (not surfaced via styled() wrappers in MUI v7).
const Root = styled('section')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.25, 1.5),
  marginBottom: theme.spacing(1),
  borderRadius: 8,
  border: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: alpha(COLORS.inkElevated, 0.5),
}));

const LangGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  gap: theme.spacing(0.5),
  '& .MuiToggleButton-root': {
    border: '1px solid transparent',
    borderRadius: 999,
    padding: theme.spacing(0.25, 1),
    color: theme.vars.palette.text.disabled,
    textTransform: 'none',
    ...theme.typography.caption,
    lineHeight: 1.4,
    transition: `background-color ${DURATION.fast}ms ${EASING.standard}, color ${DURATION.fast}ms ${EASING.standard}, border-color ${DURATION.fast}ms ${EASING.standard}`,
    '&.Mui-selected': {
      backgroundColor: alpha(COLORS.cyan, 0.1),
      color: COLORS.cyan,
      borderColor: alpha(COLORS.cyan, 0.2),
      '&:hover': {
        backgroundColor: alpha(COLORS.cyan, 0.18),
      },
    },
    '&:hover': {
      backgroundColor: alpha(COLORS.cyan, 0.06),
      color: theme.vars.palette.text.primary,
    },
  },
}));

const Flag = styled('span')({
  marginRight: 6,
  fontSize: '0.95em',
  lineHeight: 1,
});

const CyanSwitch = styled(Switch)(({ theme }) => ({
  '& .MuiSwitch-switchBase.Mui-checked': {
    color: theme.vars.palette.secondary.main,
    '&:hover': {
      backgroundColor: alpha(COLORS.cyan, 0.08),
    },
  },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
    backgroundColor: theme.vars.palette.secondary.main,
  },
}));

const TranslateSelect = styled(Select<string>)(({ theme }) => ({
  minWidth: 140,
  ...theme.typography.caption,
  '& .MuiOutlinedInput-input': {
    paddingBlock: theme.spacing(0.75),
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: alpha(COLORS.cyan, 0.3),
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: COLORS.cyan,
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: COLORS.cyan,
  },
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TranslationTabsProps {
  activeLang: MbaListingLanguage;
  onLangChange: (lang: MbaListingLanguage) => void;
  autoTranslate: boolean;
  onAutoTranslateChange: (v: boolean) => void;
  onTranslateToAll: (targetLang: MbaListingLanguage) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TRANSLATE_PLACEHOLDER = '__placeholder__';

const TranslationTabs = ({
  activeLang,
  onLangChange,
  autoTranslate,
  onAutoTranslateChange,
  onTranslateToAll,
}: TranslationTabsProps) => {
  const { t } = useTranslation();

  const handleLangChange = useCallback(
    (_e: React.MouseEvent<HTMLElement>, next: string | null) => {
      if (!next) return;
      onLangChange(next as MbaListingLanguage);
    },
    [onLangChange],
  );

  const handleTranslateTo = useCallback(
    (e: SelectChangeEvent<string>) => {
      const value = e.target.value;
      if (value && value !== TRANSLATE_PLACEHOLDER) {
        onTranslateToAll(value as MbaListingLanguage);
        // Stub wiring — log for D5
        console.log('[TranslationTabs] translate to:', value);
      }
    },
    [onTranslateToAll],
  );

  return (
    <Root aria-label={t('publish.edit.translation.title', {
      defaultValue: 'Language',
    })}>
      <LangGroup
        value={activeLang}
        exclusive
        onChange={handleLangChange}
        aria-label={t('publish.edit.translation.selectLanguage', {
          defaultValue: 'Select language',
        })}
      >
        {MBA_LANGUAGES.map((lang) => (
          // Round-5: every language tab is enabled. Title + 2 bullets +
          // description read/write from `translations[lang]`; brand +
          // keyword_context stay global (disabled on the non-EN tabs with
          // a helper-text explanation — see ListingFieldsSection).
          <ToggleButton
            key={lang.code}
            value={lang.code}
            aria-label={lang.label}
          >
            <Flag aria-hidden>{lang.flag}</Flag>
            {lang.label}
          </ToggleButton>
        ))}
      </LangGroup>

      <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
        <FormControlLabel
          control={
            <CyanSwitch
              size="small"
              checked={autoTranslate}
              onChange={(e) => onAutoTranslateChange(e.target.checked)}
              inputProps={{ 'aria-label': t('publish.edit.translation.autoTranslate', { defaultValue: 'Auto Translate' }) }}
            />
          }
          label={
            <Typography variant="caption" color="text.secondary">
              {t('publish.edit.translation.autoTranslate', {
                defaultValue: 'Auto Translate',
              })}
            </Typography>
          }
          sx={{ marginLeft: 0, gap: 0.5 }}
        />

        <Box>
          <TranslateSelect
            size="small"
            value={TRANSLATE_PLACEHOLDER}
            onChange={handleTranslateTo}
            displayEmpty
            inputProps={{
              'aria-label': t('publish.edit.translation.translateTo', {
                defaultValue: 'Translate to',
              }),
            }}
          >
            <MenuItem value={TRANSLATE_PLACEHOLDER} disabled>
              {t('publish.edit.translation.translateTo', {
                defaultValue: 'Translate to…',
              })}
            </MenuItem>
            {MBA_LANGUAGES.filter((lang) => lang.code !== activeLang).map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                {lang.flag} {lang.label}
              </MenuItem>
            ))}
          </TranslateSelect>
        </Box>
      </Stack>
    </Root>
  );
};

export default TranslationTabs;
