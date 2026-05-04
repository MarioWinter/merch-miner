import { Stack, Slider, TextField, Typography, Box, Button, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { DEFAULT_COLOR_DEFRINGE_PARAMS } from '../../utils/imageProcessing';
import type { ColorDefringeParams } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface ColorDefringeToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveParams = (params: Record<string, unknown>): ColorDefringeParams => ({
  edgeWidth: (params.edgeWidth as number) ?? DEFAULT_COLOR_DEFRINGE_PARAMS.edgeWidth,
  alphaThreshold:
    (params.alphaThreshold as number) ?? DEFAULT_COLOR_DEFRINGE_PARAMS.alphaThreshold,
  colorTolerance:
    (params.colorTolerance as number) ?? DEFAULT_COLOR_DEFRINGE_PARAMS.colorTolerance,
});

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const ParamLabel = styled(Typography)({
  fontSize: 11,
  fontWeight: 500,
  marginBottom: 2,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const SliderRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const ColorDefringeToolParams = ({
  params,
  onChange,
  disabled,
}: ColorDefringeToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveParams(params);

  const update = (patch: Partial<ColorDefringeParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_COLOR_DEFRINGE_PARAMS });
  };

  const isDefault =
    resolved.edgeWidth === DEFAULT_COLOR_DEFRINGE_PARAMS.edgeWidth &&
    resolved.alphaThreshold === DEFAULT_COLOR_DEFRINGE_PARAMS.alphaThreshold &&
    resolved.colorTolerance === DEFAULT_COLOR_DEFRINGE_PARAMS.colorTolerance;

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {/* Edge Width */}
      <Box>
        <Tooltip
          title={t('design.tools.colorDefringeParams.edgeWidthHint')}
          placement="top"
        >
          <ParamLabel color="text.secondary">
            {t('design.tools.colorDefringeParams.edgeWidth')}
          </ParamLabel>
        </Tooltip>
        <SliderRow>
          <Slider
            value={resolved.edgeWidth}
            onChange={(_, v) => update({ edgeWidth: v as number })}
            min={1}
            max={5}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.colorDefringeParams.edgeWidth')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.edgeWidth}
            onChange={(e) => {
              const num = Math.max(1, Math.min(5, Number(e.target.value) || 1));
              update({ edgeWidth: num });
            }}
            slotProps={{ htmlInput: { min: 1, max: 5, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Alpha Threshold */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.colorDefringeParams.alphaThreshold')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.alphaThreshold}
            onChange={(_, v) => update({ alphaThreshold: v as number })}
            min={0}
            max={255}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.colorDefringeParams.alphaThreshold')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.alphaThreshold}
            onChange={(e) => {
              const num = Math.max(0, Math.min(255, Number(e.target.value) || 0));
              update({ alphaThreshold: num });
            }}
            slotProps={{ htmlInput: { min: 0, max: 255, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Color Tolerance */}
      <Box>
        <Tooltip
          title={t('design.tools.colorDefringeParams.colorToleranceHint')}
          placement="top"
        >
          <ParamLabel color="text.secondary">
            {t('design.tools.colorDefringeParams.colorTolerance')}
          </ParamLabel>
        </Tooltip>
        <SliderRow>
          <Slider
            value={resolved.colorTolerance}
            onChange={(_, v) => update({ colorTolerance: v as number })}
            min={0}
            max={100}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.colorDefringeParams.colorTolerance')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.colorTolerance}
            onChange={(e) => {
              const num = Math.max(0, Math.min(100, Number(e.target.value) || 0));
              update({ colorTolerance: num });
            }}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Reset */}
      <Button
        size="small"
        variant="text"
        color="inherit"
        startIcon={<RestartAltIcon sx={{ fontSize: 14 }} />}
        onClick={handleReset}
        disabled={isDefault}
        sx={{ alignSelf: 'flex-start', fontSize: 11, textTransform: 'none' }}
      >
        {t('design.tools.colorAdjustmentParams.reset')}
      </Button>
    </Stack>
  );
};
