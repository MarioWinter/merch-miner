import {
  Stack,
  Slider,
  TextField,
  Switch,
  Typography,
  Box,
  Button,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { DEFAULT_DEFRINGE_PARAMS } from '../../utils/imageProcessing';
import type { DefringeParams } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface DefringeToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveParams = (params: Record<string, unknown>): DefringeParams => ({
  shrinkPx: (params.shrinkPx as number) ?? DEFAULT_DEFRINGE_PARAMS.shrinkPx,
  detectThreshold:
    (params.detectThreshold as number) ?? DEFAULT_DEFRINGE_PARAMS.detectThreshold,
  autoDetect: (params.autoDetect as boolean) ?? DEFAULT_DEFRINGE_PARAMS.autoDetect,
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

const SwitchRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const DefringeToolParams = ({
  params,
  onChange,
  disabled,
}: DefringeToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveParams(params);

  const update = (patch: Partial<DefringeParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handleAutoDetectToggle = () => {
    update({ autoDetect: !resolved.autoDetect });
  };

  const handleShrinkSlider = (_: Event, value: number | number[]) => {
    update({ shrinkPx: value as number });
  };

  const handleShrinkInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(0, Math.min(5, Number(e.target.value) || 0));
    update({ shrinkPx: num });
  };

  const handleThresholdSlider = (_: Event, value: number | number[]) => {
    update({ detectThreshold: value as number });
  };

  const handleThresholdInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(0, Math.min(255, Number(e.target.value) || 0));
    update({ detectThreshold: num });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_DEFRINGE_PARAMS });
  };

  const isDefault =
    resolved.shrinkPx === DEFAULT_DEFRINGE_PARAMS.shrinkPx &&
    resolved.detectThreshold === DEFAULT_DEFRINGE_PARAMS.detectThreshold &&
    resolved.autoDetect === DEFAULT_DEFRINGE_PARAMS.autoDetect;

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {/* Auto-Detect */}
      <SwitchRow>
        <ParamLabel color="text.secondary">
          {t('design.tools.defringeParams.autoDetect')}
        </ParamLabel>
        <Switch
          size="small"
          checked={resolved.autoDetect}
          onChange={handleAutoDetectToggle}
          aria-label={t('design.tools.defringeParams.autoDetect')}
        />
      </SwitchRow>

      {/* Shrink (px) */}
      <Box>
        <Tooltip
          title={resolved.autoDetect ? t('design.tools.defringeParams.autoDetected') : ''}
          placement="top"
        >
          <ParamLabel color="text.secondary">
            {t('design.tools.defringeParams.shrinkPx')}
          </ParamLabel>
        </Tooltip>
        <SliderRow>
          <Slider
            value={resolved.shrinkPx}
            onChange={handleShrinkSlider}
            min={0}
            max={5}
            step={1}
            size="small"
            disabled={resolved.autoDetect}
            sx={{ flex: 1 }}
            aria-label={t('design.tools.defringeParams.shrinkPx')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.shrinkPx}
            onChange={handleShrinkInput}
            disabled={resolved.autoDetect}
            slotProps={{ htmlInput: { min: 0, max: 5, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Edge Threshold */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.defringeParams.edgeThreshold')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.detectThreshold}
            onChange={handleThresholdSlider}
            min={0}
            max={255}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.defringeParams.edgeThreshold')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.detectThreshold}
            onChange={handleThresholdInput}
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
