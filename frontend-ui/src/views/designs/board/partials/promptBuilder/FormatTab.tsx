import {
  Box,
  FormControl,
  Grid,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const ORIENTATIONS = ['landscape', 'portrait', 'square'] as const;
const ASPECT_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'] as const;
const DETAIL_LEVELS = ['minimal', 'moderate', 'detailed', 'hyper_detailed'] as const;
const RENDERING_STYLES = ['flat', 'realistic', 'semi_realistic', 'painterly', 'cel_shaded', '3d_render'] as const;
const COMPOSITIONS = [
  'centered',
  'rule_of_thirds',
  'symmetrical',
  'asymmetrical',
  'full_bleed',
  'floating',
  'tiled',
  'scattered',
  'stacked',
] as const;

export type Orientation = (typeof ORIENTATIONS)[number];
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export type DetailLevel = (typeof DETAIL_LEVELS)[number];
export type RenderingStyle = (typeof RENDERING_STYLES)[number];
export type Composition = (typeof COMPOSITIONS)[number];

export interface FormatTabState {
  orientation: Orientation | '';
  aspectRatio: AspectRatio | '';
  detailLevel: DetailLevel | '';
  renderingStyle: RenderingStyle | '';
  composition: Composition | '';
}

interface FormatTabProps {
  state: FormatTabState;
  onChange: (patch: Partial<FormatTabState>) => void;
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
})) as typeof Select;

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

interface FieldConfig {
  key: keyof FormatTabState;
  labelKey: string;
  options: readonly string[];
  placeholderKey: string;
}

const FIELDS: FieldConfig[] = [
  { key: 'orientation', labelKey: 'orientation', options: ORIENTATIONS, placeholderKey: 'selectOrientation' },
  { key: 'aspectRatio', labelKey: 'aspectRatio', options: ASPECT_RATIOS, placeholderKey: 'selectAspectRatio' },
  { key: 'detailLevel', labelKey: 'detailLevel', options: DETAIL_LEVELS, placeholderKey: 'selectDetailLevel' },
  { key: 'renderingStyle', labelKey: 'renderingStyle', options: RENDERING_STYLES, placeholderKey: 'selectRenderingStyle' },
];

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const FormatTab = ({ state, onChange }: FormatTabProps) => {
  const { t } = useTranslation();

  const handleChange = (key: keyof FormatTabState) => (e: SelectChangeEvent<string>) => {
    onChange({ [key]: e.target.value });
  };

  const renderSelect = (field: FieldConfig) => (
    <Box key={field.key}>
      <FieldLabel>
        {t(`design.promptBuilder.format.${field.labelKey}`, field.labelKey.replace(/([A-Z])/g, ' $1').trim())}
      </FieldLabel>
      <FormControl fullWidth size="small">
        <StyledSelect
          displayEmpty
          value={state[field.key]}
          onChange={handleChange(field.key)}
          renderValue={(val) =>
            val
              ? t(`design.promptBuilder.format.options.${val}`, String(val).replace(/_/g, ' '))
              : (
                  <Typography variant="body2" color="text.disabled">
                    {t(`design.promptBuilder.format.${field.placeholderKey}`, 'Select')}
                  </Typography>
                )
          }
        >
          {field.options.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {t(`design.promptBuilder.format.options.${opt}`, opt.replace(/_/g, ' '))}
            </MenuItem>
          ))}
        </StyledSelect>
      </FormControl>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* 2x2 grid: Orientation, Aspect Ratio, Detail Level, Rendering Style */}
      <Grid container spacing={2}>
        {FIELDS.map((field) => (
          <Grid key={field.key} size={{ xs: 12, sm: 6 }}>
            {renderSelect(field)}
          </Grid>
        ))}
      </Grid>

      {/* Full-width: Composition */}
      <Box>
        <FieldLabel>
          {t('design.promptBuilder.format.composition', 'Composition')}
        </FieldLabel>
        <FormControl fullWidth size="small">
          <StyledSelect
            displayEmpty
            value={state.composition}
            onChange={handleChange('composition')}
            renderValue={(val) =>
              val
                ? t(`design.promptBuilder.format.options.${val}`, String(val).replace(/_/g, ' '))
                : (
                    <Typography variant="body2" color="text.disabled">
                      {t('design.promptBuilder.format.selectComposition', 'Select composition')}
                    </Typography>
                  )
            }
          >
            {COMPOSITIONS.map((comp) => (
              <MenuItem key={comp} value={comp}>
                {t(`design.promptBuilder.format.options.${comp}`, comp.replace(/_/g, ' '))}
              </MenuItem>
            ))}
          </StyledSelect>
        </FormControl>
      </Box>
    </Box>
  );
};

export default FormatTab;
