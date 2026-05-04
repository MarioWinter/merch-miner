import {
  Stack,
  Slider,
  Switch,
  Chip,
  Typography,
  Box,
  Button,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { DEFAULT_TRANSPARENCY_CLEANER_PARAMS } from '../../utils/imageProcessing';
import type {
  TransparencyCleanerParams,
  TransparencyCleanerHighlightColor,
} from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface TransparencyCleanerToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveParams = (params: Record<string, unknown>): TransparencyCleanerParams => ({
  threshold:
    (params.threshold as number) ?? DEFAULT_TRANSPARENCY_CLEANER_PARAMS.threshold,
  mode:
    (params.mode as TransparencyCleanerParams['mode']) ??
    DEFAULT_TRANSPARENCY_CLEANER_PARAMS.mode,
  highlightColor:
    (params.highlightColor as TransparencyCleanerHighlightColor) ??
    DEFAULT_TRANSPARENCY_CLEANER_PARAMS.highlightColor,
  visibility:
    (params.visibility as number) ?? DEFAULT_TRANSPARENCY_CLEANER_PARAMS.visibility,
});

const HIGHLIGHT_COLORS: Array<{
  value: TransparencyCleanerHighlightColor;
  cssColor: string;
}> = [
  { value: 'pink', cssColor: '#FF69B4' },
  { value: 'green', cssColor: '#00FF80' },
  { value: 'cyan', cssColor: '#00C8D7' },
  { value: 'magenta', cssColor: '#FF00FF' },
];

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

const SectionLabel = styled(Typography)(({ theme }) => ({
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.08em',
  color: theme.vars.palette.text.disabled,
  textTransform: 'uppercase',
  marginTop: 4,
}));

const ColorSwatchButton = styled('button')<{ selected?: boolean }>(
  ({ selected }) => ({
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: selected ? '2px solid #fff' : '2px solid transparent',
    outline: selected ? '1px solid rgba(255,255,255,0.3)' : 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'border-color 150ms',
    '&:hover': {
      borderColor: '#fff',
    },
  }),
);

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const TransparencyCleanerToolParams = ({
  params,
  onChange,
  disabled,
}: TransparencyCleanerToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveParams(params);

  const update = (patch: Partial<TransparencyCleanerParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handleSlider = (_: Event, value: number | number[]) => {
    update({ threshold: value as number });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_TRANSPARENCY_CLEANER_PARAMS });
  };

  const isDefault =
    resolved.threshold === DEFAULT_TRANSPARENCY_CLEANER_PARAMS.threshold &&
    resolved.mode === DEFAULT_TRANSPARENCY_CLEANER_PARAMS.mode &&
    resolved.highlightColor === DEFAULT_TRANSPARENCY_CLEANER_PARAMS.highlightColor &&
    resolved.visibility === DEFAULT_TRANSPARENCY_CLEANER_PARAMS.visibility;

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {/* Row 1: THRESHOLD label + Auto chip + VIEW <switch> DELETE */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
        <SectionLabel sx={{ mt: 0, mr: 0.5 }}>
          {t('design.tools.transparencyCleanerParams.threshold')}
        </SectionLabel>
        <Chip
          label="Auto"
          size="small"
          variant="outlined"
          onClick={() => update({ threshold: 128 })}
          sx={{ height: 20, fontSize: 10, cursor: 'pointer' }}
        />
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            variant="caption"
            sx={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: resolved.mode === 'view'
                ? 'text.primary'
                : 'text.disabled',
            }}
          >
            {t('design.tools.transparencyCleanerParams.view')}
          </Typography>
          <Switch
            size="small"
            checked={resolved.mode === 'delete'}
            onChange={(_, checked) => update({ mode: checked ? 'delete' : 'view' })}
            aria-label={t('design.tools.transparencyCleanerParams.mode')}
          />
          <Typography
            variant="caption"
            sx={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: resolved.mode === 'delete'
                ? 'text.primary'
                : 'text.disabled',
            }}
          >
            {t('design.tools.transparencyCleanerParams.delete')}
          </Typography>
        </Box>
      </Box>

      {/* Threshold Slider + percentage */}
      <SliderRow>
        <Slider
          value={resolved.threshold}
          onChange={handleSlider}
          min={0}
          max={255}
          step={1}
          size="small"
          sx={{ flex: 1 }}
          aria-label={t('design.tools.transparencyCleanerParams.threshold')}
        />
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 32 }}>
          {Math.round((resolved.threshold / 255) * 100)}%
        </Typography>
      </SliderRow>

      {/* HIGHLIGHT COLOR — always visible */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <SectionLabel sx={{ mt: 0 }}>
            {t('design.tools.transparencyCleanerParams.highlightColor')}
          </SectionLabel>
          {HIGHLIGHT_COLORS.map(({ value, cssColor }) => (
            <Tooltip key={value} title={t(`design.tools.transparencyCleanerParams.color_${value}`)}>
              <ColorSwatchButton
                selected={resolved.highlightColor === value}
                onClick={() => update({ highlightColor: value })}
                style={{ backgroundColor: cssColor }}
                aria-label={t(`design.tools.transparencyCleanerParams.color_${value}`)}
              />
            </Tooltip>
          ))}
        </Box>
      </Box>

      {/* Visibility — always visible */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <ParamLabel color="text.secondary" sx={{ mb: 0 }}>
            {t('design.tools.transparencyCleanerParams.visibility')}
          </ParamLabel>
          <Typography variant="caption" color="text.secondary">
            {resolved.visibility}px
          </Typography>
        </Box>
        <Slider
          value={resolved.visibility}
          onChange={(_, v) => update({ visibility: v as number })}
          min={1}
          max={20}
          step={1}
          size="small"
          aria-label={t('design.tools.transparencyCleanerParams.visibility')}
        />
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
