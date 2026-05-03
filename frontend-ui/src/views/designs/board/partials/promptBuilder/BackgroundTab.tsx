import { useCallback } from 'react';
import {
  Box,
  Chip,
  FormControl,
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

const BG_TYPES = ['transparent', 'solid', 'gradient'] as const;

export type BgType = (typeof BG_TYPES)[number];

interface BgPreset {
  key: string;
  label: string;
  color: string | null; // null = transparent
}

const BG_PRESETS: BgPreset[] = [
  { key: 'transparent', label: 'Transparent', color: null },
  { key: 'light_gray', label: 'Light Gray', color: '#D3D3D3' },
  { key: 'neon_pink', label: 'Neon Pink', color: '#FF69B4' },
  { key: 'neon_green', label: 'Neon Green', color: '#39FF14' },
];

export interface BackgroundTabState {
  bgType: BgType | '';
  selectedPreset: string;
}

interface BackgroundTabProps {
  state: BackgroundTabState;
  onChange: (patch: Partial<BackgroundTabState>) => void;
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

const PresetChip = styled(Chip)<{ selected: number }>(({ selected }) => ({
  borderRadius: 6,
  fontWeight: 500,
  cursor: 'pointer',
  backgroundColor: selected ? alpha(COLORS.cyan, 0.10) : 'transparent',
  color: selected ? COLORS.cyan : undefined,
  border: selected
    ? `1px solid ${COLORS.cyan}`
    : `1px solid ${alpha(COLORS.cyan, 0.2)}`,
  '&:hover': {
    backgroundColor: alpha(COLORS.cyan, 0.08),
  },
}));

const PresetColorDot = styled('span')<{ dotColor: string | null }>(({ dotColor }) => ({
  width: 14,
  height: 14,
  borderRadius: '50%',
  display: 'inline-block',
  backgroundColor: dotColor ?? 'transparent',
  border: dotColor ? 'none' : '2px dashed currentColor',
  ...(dotColor === null && {
    backgroundImage:
      'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
    backgroundSize: '6px 6px',
    backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px',
  }),
}));

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const BackgroundTab = ({ state, onChange }: BackgroundTabProps) => {
  const { t } = useTranslation();

  const handleTypeChange = useCallback(
    (e: SelectChangeEvent<string>) => {
      onChange({ bgType: e.target.value as BgType });
    },
    [onChange],
  );

  const handlePresetClick = useCallback(
    (key: string) => {
      const next = state.selectedPreset === key ? '' : key;
      onChange({ selectedPreset: next });
    },
    [state.selectedPreset, onChange],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Background Type selector */}
      <Box>
        <FieldLabel>
          {t('design.promptBuilder.background.type', 'Background Type')}
        </FieldLabel>
        <FormControl fullWidth size="small">
          <StyledSelect
            displayEmpty
            value={state.bgType}
            onChange={handleTypeChange}
            renderValue={(val) =>
              val
                ? t(`design.promptBuilder.background.types.${val}`, String(val).replace(/_/g, ' '))
                : (
                    <Typography variant="body2" color="text.disabled">
                      {t('design.promptBuilder.background.selectType', 'Select background type')}
                    </Typography>
                  )
            }
          >
            {BG_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {t(`design.promptBuilder.background.types.${type}`, type.replace(/_/g, ' '))}
              </MenuItem>
            ))}
          </StyledSelect>
        </FormControl>
      </Box>

      {/* Preset chips */}
      <Box>
        <FieldLabel>
          {t('design.promptBuilder.background.presets', 'Background Presets')}
        </FieldLabel>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {BG_PRESETS.map((preset) => (
            <PresetChip
              key={preset.key}
              selected={state.selectedPreset === preset.key ? 1 : 0}
              label={t(`design.promptBuilder.background.preset.${preset.key}`, preset.label)}
              icon={<PresetColorDot dotColor={preset.color} />}
              onClick={() => handlePresetClick(preset.key)}
              aria-pressed={state.selectedPreset === preset.key}
            />
          ))}
        </Box>
      </Box>

      {/* Info text */}
      <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>
        {t(
          'design.promptBuilder.background.hint',
          'MBA designs work best with Light Gray, Neon Pink, or Neon Green backgrounds for clean background removal.',
        )}
      </Typography>
    </Box>
  );
};

export default BackgroundTab;
