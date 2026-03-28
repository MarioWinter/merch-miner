import { useState } from 'react';
import { Box, Chip, TextField, Typography, Button, Link } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Controller, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ListingFormValues } from '../schemas/listingSchema';
import { LISTING_CHAR_LIMITS } from '../types';

interface KeywordChipsFieldProps {
  control: Control<ListingFormValues>;
}

const KeywordChipsField = ({ control }: KeywordChipsFieldProps) => {
  const { t } = useTranslation();
  const [addValue, setAddValue] = useState('');

  return (
    <Controller
      name="backend_keywords"
      control={control}
      render={({ field }) => {
        const keywords = (field.value ?? '')
          .split(',')
          .map((k: string) => k.trim())
          .filter(Boolean);

        const handleRemove = (keyword: string) => {
          const updated = keywords.filter((k: string) => k !== keyword).join(', ');
          field.onChange(updated);
        };

        const handleAdd = () => {
          if (!addValue.trim()) return;
          const newKeywords = addValue
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean);
          const all = [...keywords, ...newKeywords];
          const joined = all.join(', ');
          if (joined.length <= LISTING_CHAR_LIMITS.backend_keywords) {
            field.onChange(joined);
            setAddValue('');
          }
        };

        const currentLength = (field.value ?? '').length;
        const maxLength = LISTING_CHAR_LIMITS.backend_keywords;

        return (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">
                {t('publish.listing.keywords')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="caption"
                  color={
                    currentLength >= maxLength
                      ? 'error.main'
                      : currentLength >= maxLength * 0.9
                        ? 'warning.main'
                        : 'text.secondary'
                  }
                >
                  {currentLength}/{maxLength}
                </Typography>
                <Link
                  href="/amazon/keywords"
                  underline="hover"
                  variant="caption"
                  color="secondary"
                >
                  {t('publish.listing.kwFinder')}
                </Link>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
              {keywords.map((keyword: string, index: number) => (
                <Chip
                  key={`${keyword}-${index}`}
                  label={keyword}
                  size="small"
                  onDelete={() => handleRemove(keyword)}
                  variant="outlined"
                />
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder={t('publish.listing.addKeyword')}
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                sx={{ flex: 1 }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAdd}
                disabled={!addValue.trim()}
              >
                {t('publish.listing.add')}
              </Button>
            </Box>
          </Box>
        );
      }}
    />
  );
};

export default KeywordChipsField;
