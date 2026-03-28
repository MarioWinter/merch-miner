import { Stack, Typography, Chip, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { AutonomyPreset } from '../types';

const PresetChip = styled(Chip, {
  shouldForwardProp: (p) => p !== 'active',
})<{ active?: boolean }>(({ theme, active }) => ({
  cursor: 'pointer',
  ...(active && {
    backgroundColor: `rgba(255, 90, 79, 0.12)`,
    color: theme.vars.palette.primary.main,
    borderColor: theme.vars.palette.primary.main,
  }),
}));

interface PresetSelectorProps {
  presets: AutonomyPreset[];
  activePresetName: string;
  loading: boolean;
  onActivate: (presetId: string) => void;
}

const PresetSelector = ({
  presets,
  activePresetName,
  loading,
  onActivate,
}: PresetSelectorProps) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Stack direction="row" gap={1}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width={100} height={28} />
        ))}
      </Stack>
    );
  }

  return (
    <Stack gap={0.5}>
      <Typography variant="caption" color="text.secondary">
        {t('agent.settings.autonomyPreset')}
      </Typography>
      <Stack direction="row" gap={0.5} flexWrap="wrap">
        {presets.map((preset) => (
          <PresetChip
            key={preset.id}
            label={preset.name}
            variant="outlined"
            size="small"
            active={preset.name.toLowerCase() === activePresetName.toLowerCase()}
            onClick={() => onActivate(preset.id)}
          />
        ))}
      </Stack>
    </Stack>
  );
};

export default PresetSelector;
