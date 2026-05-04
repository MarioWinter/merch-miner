import { Stack, Typography, Box, Button, Select, MenuItem, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import CloudIcon from '@mui/icons-material/Cloud';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const InfoBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 8,
  backgroundColor: 'rgba(0, 200, 215, 0.08)',
  border: `1px solid ${theme.vars.palette.secondary.main}20`,
}));

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

const MODELS = [
  { value: 'birefnet-general-lite', label: 'BiRefNet Lite (best)' },
  { value: 'isnet-general-use', label: 'ISNet (balanced)' },
  { value: 'u2net', label: 'U2Net (basic)' },
  { value: 'isnet-anime', label: 'ISNet Anime' },
  { value: 'silueta', label: 'Silueta (lightweight)' },
  // birefnet-general excluded — needs ~2GB RAM, OOM-kills Docker workers
] as const;

interface BgRemoveToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
  onRunNow?: () => void;
  isProcessing?: boolean;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const BgRemoveToolParams = ({
  params,
  onChange,
  disabled,
  onRunNow,
  isProcessing,
}: BgRemoveToolParamsProps) => {
  const { t } = useTranslation();
  const model = (params.model as string) ?? 'birefnet-general-lite';

  return (
    <Stack spacing={1.5} sx={{ opacity: disabled ? 0.5 : 1 }}>
      <InfoBox>
        <CloudIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
        <Typography variant="caption" color="text.secondary">
          {t('design.tools.bgRemoveParams.serverInfo')}
        </Typography>
      </InfoBox>

      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">
          {t('design.tools.bgRemoveParams.model')}
        </Typography>
        <Select
          size="small"
          value={model}
          onChange={(e) => onChange({ ...params, model: e.target.value })}
          disabled={disabled || isProcessing}
          sx={{ fontSize: 13 }}
        >
          {MODELS.map((m) => (
            <MenuItem key={m.value} value={m.value} sx={{ fontSize: 13 }}>
              {m.label}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      {onRunNow && (
        <Button
          variant="contained"
          color="secondary"
          size="small"
          onClick={onRunNow}
          disabled={disabled || isProcessing}
          startIcon={isProcessing ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
          fullWidth
        >
          {isProcessing
            ? t('design.tools.bgRemoveParams.processing')
            : t('design.tools.bgRemoveParams.runNow')}
        </Button>
      )}

      <Typography variant="caption" color="text.disabled">
        {t('design.tools.bgRemoveParams.description')}
      </Typography>
    </Stack>
  );
};
