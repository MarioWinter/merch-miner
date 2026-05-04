import { Stack, Typography, Button, Switch, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { DEFAULT_TRANSPARENCY_HIGHLIGHTER_PARAMS } from '../../utils/imageProcessing';
import type { TransparencyHighlighterParams } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface TransparencyHighlighterToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveParams = (params: Record<string, unknown>): TransparencyHighlighterParams => ({
  highlightColor:
    (params.highlightColor as TransparencyHighlighterParams['highlightColor']) ??
    DEFAULT_TRANSPARENCY_HIGHLIGHTER_PARAMS.highlightColor,
  fullyTransparentColor:
    (params.fullyTransparentColor as string) ??
    DEFAULT_TRANSPARENCY_HIGHLIGHTER_PARAMS.fullyTransparentColor,
  showOpaque:
    (params.showOpaque as boolean) ?? DEFAULT_TRANSPARENCY_HIGHLIGHTER_PARAMS.showOpaque,
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

const SwitchRow = styled('div')({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const TransparencyHighlighterToolParams = ({
  params,
  onChange,
  disabled,
}: TransparencyHighlighterToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveParams(params);

  const update = (patch: Partial<TransparencyHighlighterParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_TRANSPARENCY_HIGHLIGHTER_PARAMS });
  };

  const isDefault =
    resolved.highlightColor === DEFAULT_TRANSPARENCY_HIGHLIGHTER_PARAMS.highlightColor &&
    resolved.showOpaque === DEFAULT_TRANSPARENCY_HIGHLIGHTER_PARAMS.showOpaque;

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {/* Highlight Color */}
      <div>
        <ParamLabel color="text.secondary">
          {t('design.tools.transparencyHighlighterParams.highlightColor')}
        </ParamLabel>
        <ToggleButtonGroup
          value={resolved.highlightColor}
          exclusive
          size="small"
          onChange={(_, value) => {
            if (value) update({ highlightColor: value });
          }}
          aria-label={t('design.tools.transparencyHighlighterParams.highlightColor')}
        >
          <ToggleButton value="red">
            {t('design.tools.transparencyHighlighterParams.red')}
          </ToggleButton>
          <ToggleButton value="yellow">
            {t('design.tools.transparencyHighlighterParams.yellow')}
          </ToggleButton>
          <ToggleButton value="magenta">
            {t('design.tools.transparencyHighlighterParams.magenta')}
          </ToggleButton>
        </ToggleButtonGroup>
      </div>

      {/* Show Opaque */}
      <SwitchRow>
        <ParamLabel color="text.secondary" sx={{ mb: 0 }}>
          {t('design.tools.transparencyHighlighterParams.showOpaque')}
        </ParamLabel>
        <Switch
          size="small"
          checked={resolved.showOpaque}
          onChange={(_, checked) => update({ showOpaque: checked })}
          aria-label={t('design.tools.transparencyHighlighterParams.showOpaque')}
        />
      </SwitchRow>

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
