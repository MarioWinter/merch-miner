import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { SettingsCard, SectionTitle } from '../../../components/SettingsCard';
import { useBillingForm } from './hooks/useBillingForm';
import { COUNTRIES, type Country } from './data/countries';

const BillingSection = () => {
  const { t } = useTranslation();
  const { form, loading, error, saving, handleSave } = useBillingForm();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const accountType = watch('account_type');

  // ----------------------------------------------------------------
  // Loading
  // ----------------------------------------------------------------
  if (loading) {
    return (
      <SettingsCard>
        <Skeleton variant="text" width={140} height={28} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={40} sx={{ mb: 2 }} />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rounded" height={40} sx={{ mb: 2 }} />
        ))}
      </SettingsCard>
    );
  }

  // ----------------------------------------------------------------
  // Error
  // ----------------------------------------------------------------
  if (error) {
    return (
      <SettingsCard>
        <Alert severity="error">{error}</Alert>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard aria-label={t('settings.billing.title')}>
      <form onSubmit={handleSubmit(handleSave)}>
      <SectionTitle>{t('settings.billing.title')}</SectionTitle>

      <Stack spacing={2.5}>
        {/* Account type toggle */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('settings.billing.accountType')}
          </Typography>
          <Controller
            name="account_type"
            control={control}
            render={({ field }) => (
              <ToggleButtonGroup
                value={field.value}
                exclusive
                onChange={(_, val) => {
                  if (val) field.onChange(val);
                }}
                aria-label={t('settings.billing.accountType')}
              >
                <ToggleButton value="personal">
                  {t('settings.billing.personal')}
                </ToggleButton>
                <ToggleButton value="business">
                  {t('settings.billing.business')}
                </ToggleButton>
              </ToggleButtonGroup>
            )}
          />
        </Box>

        {/* Business-only fields */}
        {accountType === 'business' && (
          <>
            <Controller
              name="company_name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t('settings.billing.companyName')}
                  fullWidth
                  error={!!errors.company_name}
                  helperText={errors.company_name?.message}
                />
              )}
            />
            <Controller
              name="vat_number"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t('settings.billing.vatNumber')}
                  fullWidth
                  error={!!errors.vat_number}
                  helperText={errors.vat_number?.message}
                />
              )}
            />
          </>
        )}

        {/* Address fields */}
        <Controller
          name="address_line1"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t('settings.billing.addressLine1')}
              fullWidth
              helperText={t('settings.billing.optionalHint')}
            />
          )}
        />
        <Controller
          name="address_line2"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t('settings.billing.addressLine2')}
              fullWidth
            />
          )}
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Controller
            name="city"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('settings.billing.city')}
                fullWidth
              />
            )}
          />
          <Controller
            name="state_region"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('settings.billing.stateRegion')}
                fullWidth
              />
            )}
          />
          <Controller
            name="postal_code"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('settings.billing.postalCode')}
                sx={{ minWidth: 140 }}
              />
            )}
          />
        </Stack>

        {/* Country autocomplete */}
        <Controller
          name="country"
          control={control}
          render={({ field }) => (
            <Autocomplete<Country>
              options={COUNTRIES}
              getOptionLabel={(o) => `${o.label} (${o.code})`}
              value={COUNTRIES.find((c) => c.code === field.value) ?? null}
              onChange={(_, val) => setValue('country', val?.code ?? '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('settings.billing.country')}
                  error={!!errors.country}
                  helperText={errors.country?.message}
                />
              )}
            />
          )}
        />
      </Stack>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          disabled={saving}
          startIcon={
            saving ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          {t('settings.billing.save')}
        </Button>
      </Box>
      </form>
    </SettingsCard>
  );
};

export default BillingSection;
