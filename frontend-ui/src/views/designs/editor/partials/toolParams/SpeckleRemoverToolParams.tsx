import {
  Stack,
  Slider,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  Box,
  Button,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { DEFAULT_SPECKLE_REMOVER_PARAMS } from '../../utils/imageProcessing';
import type { SpeckleRemoverParams } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface SpeckleRemoverToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveParams = (params: Record<string, unknown>): SpeckleRemoverParams => ({
  minSize: (params.minSize as number) ?? DEFAULT_SPECKLE_REMOVER_PARAMS.minSize,
  connectivity:
    (params.connectivity as SpeckleRemoverParams['connectivity']) ??
    DEFAULT_SPECKLE_REMOVER_PARAMS.connectivity,
  alphaThreshold:
    (params.alphaThreshold as number) ?? DEFAULT_SPECKLE_REMOVER_PARAMS.alphaThreshold,
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

const CompactToggleButton = styled(ToggleButton)({
  padding: '4px 8px',
  fontSize: 11,
  textTransform: 'none',
  lineHeight: 1.2,
});

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const SpeckleRemoverToolParams = ({
  params,
  onChange,
  disabled,
}: SpeckleRemoverToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveParams(params);

  const update = (patch: Partial<SpeckleRemoverParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handleMinSizeSlider = (_: Event, value: number | number[]) => {
    update({ minSize: value as number });
  };

  const handleMinSizeInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(1, Math.min(500, Number(e.target.value) || 1));
    update({ minSize: num });
  };

  const handleConnectivity = (
    _: React.MouseEvent<HTMLElement>,
    value: SpeckleRemoverParams['connectivity'] | null,
  ) => {
    if (value) update({ connectivity: value });
  };

  const handleAlphaSlider = (_: Event, value: number | number[]) => {
    update({ alphaThreshold: value as number });
  };

  const handleAlphaInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(0, Math.min(255, Number(e.target.value) || 0));
    update({ alphaThreshold: num });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_SPECKLE_REMOVER_PARAMS });
  };

  const isDefault =
    resolved.minSize === DEFAULT_SPECKLE_REMOVER_PARAMS.minSize &&
    resolved.connectivity === DEFAULT_SPECKLE_REMOVER_PARAMS.connectivity &&
    resolved.alphaThreshold === DEFAULT_SPECKLE_REMOVER_PARAMS.alphaThreshold;

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {/* Min Group Size */}
      <Box>
        <Tooltip title={t('design.tools.speckleRemoverParams.minSizeHint')} placement="top">
          <ParamLabel color="text.secondary">
            {t('design.tools.speckleRemoverParams.minSize')}
          </ParamLabel>
        </Tooltip>
        <SliderRow>
          <Slider
            value={resolved.minSize}
            onChange={handleMinSizeSlider}
            min={1}
            max={500}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.speckleRemoverParams.minSize')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.minSize}
            onChange={handleMinSizeInput}
            slotProps={{ htmlInput: { min: 1, max: 500, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Connectivity */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.speckleRemoverParams.connectivity')}
        </ParamLabel>
        <ToggleButtonGroup
          value={resolved.connectivity}
          exclusive
          onChange={handleConnectivity}
          size="small"
          fullWidth
          aria-label={t('design.tools.speckleRemoverParams.connectivity')}
        >
          <CompactToggleButton value={4}>
            {t('design.tools.speckleRemoverParams.fourWay')}
          </CompactToggleButton>
          <CompactToggleButton value={8}>
            {t('design.tools.speckleRemoverParams.eightWay')}
          </CompactToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Alpha Threshold */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.speckleRemoverParams.alphaThreshold')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.alphaThreshold}
            onChange={handleAlphaSlider}
            min={0}
            max={255}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.speckleRemoverParams.alphaThreshold')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.alphaThreshold}
            onChange={handleAlphaInput}
            slotProps={{ htmlInput: { min: 0, max: 255, step: 1 } }}
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
