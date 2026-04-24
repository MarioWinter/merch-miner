import {
  Box,
  FormControl,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import { Controller, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { MbaListingFormValues } from '../../schemas/mbaListingSchema';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OptionsSectionProps {
  control: Control<MbaListingFormValues>;
}

// ---------------------------------------------------------------------------
// Component — Phase P9 (replaces OptionsTrademarksTabs)
// ---------------------------------------------------------------------------

/**
 * Availability + Publish-Mode radio groups for the listing.
 *
 * The pre-P9 version wrapped these in MUI Tabs alongside a "Trademarks"
 * panel that hosted the retired TM-Check flow. P9 drops the entire
 * Trademarks tab — AI Improve (Phase M/P7) folds brand-safety into the
 * generated copy — so the Tabs chrome is gone and only these two radio
 * groups remain.
 */
const OptionsSection = ({ control }: OptionsSectionProps) => {
  const { t } = useTranslation();

  return (
    <Box
      component="section"
      data-testid="OptionsSection"
      aria-label={t('publish.edit.options.sectionLabel', {
        defaultValue: 'Listing options',
      })}
    >
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="overline" color="text.secondary">
            {t('publish.edit.options.availability.title', {
              defaultValue: 'Availability',
            })}
          </Typography>
          <Controller
            control={control}
            name="availability"
            render={({ field }) => (
              <FormControl component="fieldset">
                <RadioGroup
                  {...field}
                  aria-label={t('publish.edit.options.availability.title', {
                    defaultValue: 'Availability',
                  })}
                >
                  <FormControlLabel
                    value="public"
                    control={<Radio color="primary" />}
                    label={t('publish.edit.options.availability.public', {
                      defaultValue: 'Public',
                    })}
                  />
                  <FormControlLabel
                    value="private"
                    control={<Radio color="primary" />}
                    label={t('publish.edit.options.availability.private', {
                      defaultValue: 'Private',
                    })}
                  />
                </RadioGroup>
              </FormControl>
            )}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="overline" color="text.secondary">
            {t('publish.edit.options.publishMode.title', {
              defaultValue: 'Publish',
            })}
          </Typography>
          <Controller
            control={control}
            name="publish_mode"
            render={({ field }) => (
              <FormControl component="fieldset">
                <RadioGroup
                  {...field}
                  aria-label={t('publish.edit.options.publishMode.title', {
                    defaultValue: 'Publish',
                  })}
                >
                  <FormControlLabel
                    value="live"
                    control={<Radio color="primary" />}
                    label={t('publish.edit.options.publishMode.live', {
                      defaultValue: 'Live',
                    })}
                  />
                  <FormControlLabel
                    value="draft"
                    control={<Radio color="primary" />}
                    label={t('publish.edit.options.publishMode.draft', {
                      defaultValue: 'Draft',
                    })}
                  />
                </RadioGroup>
              </FormControl>
            )}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default OptionsSection;
