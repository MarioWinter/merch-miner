import {
  Stack,
  Switch,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  FormControlLabel,
  Box,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { DEFAULT_ROTATE_FLIP_PARAMS } from '../../utils/imageProcessing';
import type { RotateFlipParams } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface RotateFlipToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveRotateFlipParams = (params: Record<string, unknown>): RotateFlipParams => ({
  rotation:
    (params.rotation as RotateFlipParams['rotation']) ?? DEFAULT_ROTATE_FLIP_PARAMS.rotation,
  flipH: (params.flipH as boolean) ?? DEFAULT_ROTATE_FLIP_PARAMS.flipH,
  flipV: (params.flipV as boolean) ?? DEFAULT_ROTATE_FLIP_PARAMS.flipV,
});

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const ParamLabel = styled(Typography)({
  fontSize: 11,
  fontWeight: 500,
  marginBottom: 2,
});

const CompactToggleButton = styled(ToggleButton)({
  padding: '4px 8px',
  fontSize: 11,
  textTransform: 'none',
  lineHeight: 1.2,
  gap: 4,
});

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const RotateFlipToolParams = ({ params, onChange, disabled }: RotateFlipToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveRotateFlipParams(params);

  const update = (patch: Partial<RotateFlipParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handleRotation = (
    _: React.MouseEvent<HTMLElement>,
    value: RotateFlipParams['rotation'] | null,
  ) => {
    if (value !== null) update({ rotation: value });
  };

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {/* Rotation */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.rotateFlipParams.rotation')}
        </ParamLabel>
        <ToggleButtonGroup
          value={resolved.rotation}
          exclusive
          onChange={handleRotation}
          size="small"
          fullWidth
          aria-label={t('design.tools.rotateFlipParams.rotation')}
        >
          <CompactToggleButton value={0}>
            {t('design.tools.rotateFlipParams.deg0')}
          </CompactToggleButton>
          <CompactToggleButton value={90}>
            <RotateRightIcon sx={{ fontSize: 16 }} />
            {t('design.tools.rotateFlipParams.deg90')}
          </CompactToggleButton>
          <CompactToggleButton value={180}>
            {t('design.tools.rotateFlipParams.deg180')}
          </CompactToggleButton>
          <CompactToggleButton value={270}>
            <RotateLeftIcon sx={{ fontSize: 16 }} />
            {t('design.tools.rotateFlipParams.deg270')}
          </CompactToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Flip Horizontal */}
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={resolved.flipH}
            onChange={(_, checked) => update({ flipH: checked })}
          />
        }
        label={
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <SwapHorizIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">
              {t('design.tools.rotateFlipParams.flipH')}
            </Typography>
          </Stack>
        }
      />

      {/* Flip Vertical */}
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={resolved.flipV}
            onChange={(_, checked) => update({ flipV: checked })}
          />
        }
        label={
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <SwapVertIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">
              {t('design.tools.rotateFlipParams.flipV')}
            </Typography>
          </Stack>
        }
      />
    </Stack>
  );
};
