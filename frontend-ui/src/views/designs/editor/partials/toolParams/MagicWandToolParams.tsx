import {
  Stack,
  Slider,
  TextField,
  Switch,
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { DEFAULT_MAGIC_WAND_PARAMS } from '../../utils/imageProcessing';
import type { MagicWandParams } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface MagicWandToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveParams = (params: Record<string, unknown>): MagicWandParams => ({
  tolerance: (params.tolerance as number) ?? DEFAULT_MAGIC_WAND_PARAMS.tolerance,
  contiguous: (params.contiguous as boolean) ?? DEFAULT_MAGIC_WAND_PARAMS.contiguous,
  action: (params.action as MagicWandParams['action']) ?? DEFAULT_MAGIC_WAND_PARAMS.action,
});

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const ParamLabel = styled(Typography)({
  fontSize: 11,
  fontWeight: 500,
  marginBottom: 2,
});

const SliderRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const CompactToggleButton = styled(ToggleButton)({
  padding: '4px 8px',
  fontSize: 11,
  textTransform: 'none',
  lineHeight: 1.2,
});

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const MagicWandToolParams = ({
  params,
  onChange,
  disabled,
}: MagicWandToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveParams(params);

  const update = (patch: Partial<MagicWandParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handleToleranceSlider = (_: Event, value: number | number[]) => {
    update({ tolerance: value as number });
  };

  const handleToleranceInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(0, Math.min(100, Number(e.target.value) || 0));
    update({ tolerance: num });
  };

  const handleActionChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (value === 'delete' || value === 'select') {
      update({ action: value });
    }
  };

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {/* Tolerance */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.magicWandParams.tolerance')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.tolerance}
            onChange={handleToleranceSlider}
            min={0}
            max={100}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.magicWandParams.tolerance')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.tolerance}
            onChange={handleToleranceInput}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Contiguous */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <ParamLabel color="text.secondary" sx={{ mb: 0 }}>
            {t('design.tools.magicWandParams.contiguous')}
          </ParamLabel>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
            {t('design.tools.magicWandParams.contiguousHint')}
          </Typography>
        </Box>
        <Switch
          size="small"
          checked={resolved.contiguous}
          onChange={(_, checked) => update({ contiguous: checked })}
          aria-label={t('design.tools.magicWandParams.contiguous')}
        />
      </Box>

      {/* Action */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.magicWandParams.action')}
        </ParamLabel>
        <ToggleButtonGroup
          value={resolved.action}
          exclusive
          onChange={handleActionChange}
          size="small"
          fullWidth
          aria-label={t('design.tools.magicWandParams.action')}
        >
          <CompactToggleButton value="delete">
            {t('design.tools.magicWandParams.actionDelete')}
          </CompactToggleButton>
          <CompactToggleButton value="select">
            {t('design.tools.magicWandParams.actionSelect')}
          </CompactToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Stack>
  );
};
