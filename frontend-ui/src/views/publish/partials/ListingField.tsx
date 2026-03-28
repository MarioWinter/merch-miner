import { Box, TextField, Typography, IconButton, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import { Controller, type Control, type FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ListingFormValues } from '../schemas/listingSchema';
import { LISTING_CHAR_LIMITS } from '../types';

const FieldWrapper = styled(Box)({
  position: 'relative',
  '&:hover .improve-icon': { opacity: 1 },
});

const CharCounter = styled(Typography, {
  shouldForwardProp: (prop) => prop !== '$severity',
})<{ $severity: 'normal' | 'amber' | 'red' }>(({ theme, $severity }) => ({
  fontSize: '0.75rem',
  textAlign: 'right',
  marginTop: 2,
  color:
    $severity === 'red'
      ? theme.vars.palette.error.main
      : $severity === 'amber'
        ? theme.vars.palette.warning.main
        : theme.vars.palette.text.secondary,
}));

type ListingFieldName = FieldPath<ListingFormValues>;

interface ListingFieldProps {
  name: ListingFieldName;
  label: string;
  control: Control<ListingFormValues>;
  multiline?: boolean;
  rows?: number;
  onImprove?: (fieldName: string, value: string) => void;
}

const ListingField = ({
  name,
  label,
  control,
  multiline = false,
  rows = 1,
  onImprove,
}: ListingFieldProps) => {
  const { t } = useTranslation();
  const maxLength = LISTING_CHAR_LIMITS[name as keyof typeof LISTING_CHAR_LIMITS];

  const getSeverity = (length: number): 'normal' | 'amber' | 'red' => {
    if (!maxLength) return 'normal';
    if (length >= maxLength) return 'red';
    if (length >= maxLength * 0.9) return 'amber';
    return 'normal';
  };

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const currentLength = (field.value as string)?.length ?? 0;
        const severity = getSeverity(currentLength);

        return (
          <FieldWrapper>
            <TextField
              {...field}
              label={label}
              fullWidth
              multiline={multiline}
              rows={rows}
              error={!!error || severity === 'red'}
              helperText={error?.message}
              variant="outlined"
              size="small"
              slotProps={{
                htmlInput: {
                  maxLength: maxLength ? maxLength + 10 : undefined,
                },
              }}
            />

            {maxLength && (
              <CharCounter $severity={severity}>
                {currentLength}/{maxLength}
              </CharCounter>
            )}

            {onImprove && (
              <Tooltip title={t('publish.listing.improve')}>
                <IconButton
                  className="improve-icon"
                  size="small"
                  onClick={() => onImprove(name, field.value as string)}
                  aria-label={t('publish.listing.improve')}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    opacity: 0,
                    transition: 'opacity 150ms',
                  }}
                >
                  <AutoFixHighOutlinedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </FieldWrapper>
        );
      }}
    />
  );
};

export default ListingField;
