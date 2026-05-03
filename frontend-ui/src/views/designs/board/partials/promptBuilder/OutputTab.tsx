import { useCallback, useState } from 'react';
import {
  Box,
  Chip,
  FormControl,
  Grid,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const USE_OPTIONS = [
  'tshirt_front',
  'tshirt_back',
  'hoodie',
  'poster',
  'mug',
  'sticker',
  'phone_case',
  'all_over_print',
] as const;

const AVOID_OPTIONS = [
  'text_heavy',
  'copyrighted_characters',
  'complex_gradients',
  'photorealism',
  'thin_lines',
  'small_details',
  'watermarks',
  'offensive_content',
] as const;

const PRINT_REQUIREMENTS = [
  'mba_standard',
  'mba_premium',
  'redbubble',
  'custom',
] as const;

const FINAL_FEEL_OPTIONS = [
  'clean_professional',
  'bold_statement',
  'vintage_worn',
  'playful_fun',
  'elegant_minimal',
  'edgy_urban',
  'nature_organic',
  'tech_futuristic',
] as const;

// MBA preset values
const MBA_PRESET = {
  use: 'tshirt_front' as string,
  printReq: 'mba_standard' as string,
  finalFeel: 'clean_professional' as string,
};

export interface OutputTabState {
  use: string;
  avoid: string;
  printRequirements: string;
  finalFeel: string;
}

interface OutputTabProps {
  state: OutputTabState;
  onChange: (patch: Partial<OutputTabState>) => void;
}

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const FieldLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.vars.palette.text.secondary,
  marginBottom: theme.spacing(0.5),
}));

const StyledSelect = styled(Select)(({ theme }) => ({
  height: 40,
  backgroundColor: alpha(COLORS.ink, 0.3),
  borderRadius: theme.shape.borderRadius,
  ...theme.applyStyles('light', {
    backgroundColor: alpha(COLORS.ash, 0.5),
  }),
})) as unknown as typeof Select;

const MbaChip = styled(Chip)<{ active: number }>(({ active }) => ({
  borderRadius: 6,
  fontWeight: 600,
  cursor: 'pointer',
  backgroundColor: active ? alpha(COLORS.successDk, 0.10) : 'transparent',
  color: active ? COLORS.successDk : undefined,
  border: active
    ? `1px solid ${COLORS.successDk}`
    : `1px solid ${alpha(COLORS.successDk, 0.3)}`,
  '&:hover': {
    backgroundColor: alpha(COLORS.successDk, 0.08),
  },
}));

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

interface FieldConfig {
  key: keyof OutputTabState;
  labelKey: string;
  options: readonly string[];
  placeholderKey: string;
}

const FIELDS: FieldConfig[] = [
  { key: 'use', labelKey: 'use', options: USE_OPTIONS, placeholderKey: 'selectUse' },
  { key: 'avoid', labelKey: 'avoid', options: AVOID_OPTIONS, placeholderKey: 'selectAvoid' },
  { key: 'printRequirements', labelKey: 'printRequirements', options: PRINT_REQUIREMENTS, placeholderKey: 'selectPrintReq' },
  { key: 'finalFeel', labelKey: 'finalFeel', options: FINAL_FEEL_OPTIONS, placeholderKey: 'selectFinalFeel' },
];

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const OutputTab = ({ state, onChange }: OutputTabProps) => {
  const { t } = useTranslation();
  const [mbaActive, setMbaActive] = useState(false);

  const handleChange = useCallback(
    (key: keyof OutputTabState) => (e: SelectChangeEvent<string>) => {
      onChange({ [key]: e.target.value });
      // Deactivate MBA preset if user manually changes a field
      setMbaActive(false);
    },
    [onChange],
  );

  const handleMbaToggle = useCallback(() => {
    if (mbaActive) {
      // Deactivate: clear MBA-set fields
      onChange({ use: '', printRequirements: '', finalFeel: '' });
      setMbaActive(false);
    } else {
      // Activate: apply MBA preset
      onChange({
        use: MBA_PRESET.use,
        printRequirements: MBA_PRESET.printReq,
        finalFeel: MBA_PRESET.finalFeel,
      });
      setMbaActive(true);
    }
  }, [mbaActive, onChange]);

  const renderSelect = (field: FieldConfig) => (
    <Box key={field.key}>
      <FieldLabel>
        {t(`design.promptBuilder.output.${field.labelKey}`, field.labelKey.replace(/([A-Z])/g, ' $1').trim())}
      </FieldLabel>
      <FormControl fullWidth size="small">
        <StyledSelect
          displayEmpty
          value={state[field.key]}
          onChange={handleChange(field.key)}
          renderValue={(val) =>
            val
              ? t(`design.promptBuilder.output.options.${val}`, String(val).replace(/_/g, ' '))
              : (
                  <Typography variant="body2" color="text.disabled">
                    {t(`design.promptBuilder.output.${field.placeholderKey}`, 'Select')}
                  </Typography>
                )
          }
        >
          {field.options.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {t(`design.promptBuilder.output.options.${opt}`, opt.replace(/_/g, ' '))}
            </MenuItem>
          ))}
        </StyledSelect>
      </FormControl>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* MBA Preset chip */}
      <Box>
        <MbaChip
          active={mbaActive ? 1 : 0}
          label={t('design.promptBuilder.output.mbaPreset', 'MBA Preset')}
          icon={mbaActive ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : undefined}
          onClick={handleMbaToggle}
          aria-pressed={mbaActive}
        />
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
          {t('design.promptBuilder.output.mbaPresetHint', '4500x5400, 300DPI, seamless edges, no bleed')}
        </Typography>
      </Box>

      {/* 2x2 grid: Use, Avoid, Print Requirements, Final Feel */}
      <Grid container spacing={2}>
        {FIELDS.map((field) => (
          <Grid key={field.key} size={{ xs: 12, sm: 6 }}>
            {renderSelect(field)}
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default OutputTab;
