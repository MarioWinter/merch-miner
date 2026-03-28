import { useState } from 'react';
import {
  Box,
  Tab,
  Tabs,
  Button,
  Switch,
  FormControlLabel,
  Typography,
  CircularProgress,
} from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import { useTranslation } from 'react-i18next';
import type { Listing, ListingLanguage, ListingTranslation } from '../types';
import { SUPPORTED_LANGUAGES, LISTING_CHAR_LIMITS } from '../types';

interface TranslationTabsProps {
  listing: Listing | undefined;
  isTranslating: boolean;
  onTranslate: (languages: ListingLanguage[]) => void;
}

const TRANSLATED_FIELDS: (keyof ListingTranslation)[] = [
  'title',
  'bullet_1',
  'bullet_2',
  'bullet_3',
  'bullet_4',
  'bullet_5',
  'description',
  'backend_keywords',
];

const TranslationTabs = ({ listing, isTranslating, onTranslate }: TranslationTabsProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [autoTranslate, setAutoTranslate] = useState(false);

  if (!listing) return null;

  const otherLanguages = SUPPORTED_LANGUAGES.filter(
    (lang) => lang.code !== listing.language,
  );

  const handleTranslateAll = () => {
    onTranslate(otherLanguages.map((l) => l.code));
  };

  const activeLang = otherLanguages[activeTab];
  const translation = activeLang
    ? listing.translations?.[activeLang.code]
    : undefined;

  const isOverLimit = (field: keyof ListingTranslation, value: string) => {
    const limit = LISTING_CHAR_LIMITS[field as keyof typeof LISTING_CHAR_LIMITS];
    return limit ? value.length > limit : false;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">{t('publish.translate.title')}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoTranslate}
                onChange={(e) => setAutoTranslate(e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2">
                {t('publish.translate.autoTranslate')}
              </Typography>
            }
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={
              isTranslating ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <TranslateIcon />
              )
            }
            onClick={handleTranslateAll}
            disabled={isTranslating}
          >
            {t('publish.translate.translateAll')}
          </Button>
        </Box>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
      >
        {otherLanguages.map((lang) => (
          <Tab key={lang.code} label={lang.label} />
        ))}
      </Tabs>

      <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: '12px' }}>
        {!translation ? (
          <Typography variant="body2" color="text.secondary">
            {t('publish.translate.notTranslated')}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {TRANSLATED_FIELDS.map((field) => {
              const value = translation[field] ?? '';
              const over = isOverLimit(field, value);
              return (
                <Box key={field}>
                  <Typography
                    variant="caption"
                    color={over ? 'error.main' : 'text.secondary'}
                    sx={{ textTransform: 'capitalize' }}
                  >
                    {field.replace(/_/g, ' ')}
                    {over && ` (${t('publish.translate.overLimit')})`}
                  </Typography>
                  <Typography
                    variant="body2"
                    color={over ? 'error.main' : 'text.primary'}
                  >
                    {value || '-'}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default TranslationTabs;
