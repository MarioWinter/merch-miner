import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ListingColorMode, ListingTypeFlag } from '../../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_FLAG_OPTIONS: ListingTypeFlag[] = ['men', 'women', 'youth'];
const COLOR_MODE_OPTIONS: Exclude<ListingColorMode, ''>[] = [
  'black',
  'white',
  'colorful',
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TypeColorOptionsProps {
  typeFlags: ListingTypeFlag[];
  colorMode: ListingColorMode;
  /** When true, hide the Color radio group (used by Displate — AC-123). */
  hideColorMode?: boolean;
  onTypeFlagsChange: (flags: ListingTypeFlag[]) => void | Promise<void>;
  onColorModeChange: (mode: ListingColorMode) => void | Promise<void>;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component — AC-88
// ---------------------------------------------------------------------------

const TypeColorOptions = ({
  typeFlags,
  colorMode,
  hideColorMode = false,
  onTypeFlagsChange,
  onColorModeChange,
  disabled = false,
}: TypeColorOptionsProps) => {
  const { t } = useTranslation();

  const handleToggleType = (flag: ListingTypeFlag) => {
    const next = typeFlags.includes(flag)
      ? typeFlags.filter((f) => f !== flag)
      : [...typeFlags, flag];
    void onTypeFlagsChange(next);
  };

  return (
    <Box
      component="section"
      data-testid="TypeColorOptions"
      aria-label={t('publish.edit.global.options.sectionLabel', {
        defaultValue: 'Global listing options',
      })}
    >
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: hideColorMode ? 12 : 6 }}>
          <Typography variant="overline" color="text.secondary">
            {t('publish.edit.global.options.types.title', {
              defaultValue: 'Types',
            })}
          </Typography>
          <FormControl
            component="fieldset"
            disabled={disabled}
            sx={{ display: 'block' }}
          >
            {TYPE_FLAG_OPTIONS.map((flag) => (
              <FormControlLabel
                key={flag}
                control={
                  <Checkbox
                    checked={typeFlags.includes(flag)}
                    onChange={() => handleToggleType(flag)}
                    color="primary"
                    inputProps={{
                      'aria-label': t(`publish.edit.global.options.types.${flag}`, {
                        defaultValue:
                          flag === 'men' ? 'Men' : flag === 'women' ? 'Women' : 'Youth',
                      }),
                    }}
                  />
                }
                label={t(`publish.edit.global.options.types.${flag}`, {
                  defaultValue:
                    flag === 'men' ? 'Men' : flag === 'women' ? 'Women' : 'Youth',
                })}
              />
            ))}
          </FormControl>
        </Grid>

        {!hideColorMode && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="overline" color="text.secondary">
              {t('publish.edit.global.options.color.title', {
                defaultValue: 'Color',
              })}
            </Typography>
            <FormControl component="fieldset" disabled={disabled}>
              <RadioGroup
                value={colorMode || ''}
                onChange={(_, v) =>
                  void onColorModeChange((v || '') as ListingColorMode)
                }
                aria-label={t('publish.edit.global.options.color.title', {
                  defaultValue: 'Color',
                })}
              >
                {COLOR_MODE_OPTIONS.map((mode) => (
                  <FormControlLabel
                    key={mode}
                    value={mode}
                    control={<Radio color="primary" />}
                    label={t(`publish.edit.global.options.color.${mode}`, {
                      defaultValue:
                        mode === 'black'
                          ? 'Black'
                          : mode === 'white'
                            ? 'White'
                            : 'Colorful',
                    })}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default TypeColorOptions;
