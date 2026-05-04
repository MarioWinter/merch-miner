import { Stack, Chip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PERSONALITY_PRESETS, type AgentType } from '../types';

interface PersonalityPresetsProps {
  agentType: AgentType;
  onSelect: (text: string) => void;
}

const PersonalityPresets = ({ agentType, onSelect }: PersonalityPresetsProps) => {
  const { t } = useTranslation();
  const presets = PERSONALITY_PRESETS.filter((p) => p.agent_type === agentType);

  if (presets.length === 0) return null;

  return (
    <Stack gap={0.5}>
      <Typography variant="caption" color="text.secondary">
        {t('agent.settings.personalityPresets')}
      </Typography>
      <Stack direction="row" gap={0.5} flexWrap="wrap">
        {presets.map((preset) => (
          <Chip
            key={preset.name}
            label={t(preset.name)}
            size="small"
            variant="outlined"
            onClick={() => onSelect(preset.text)}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Stack>
    </Stack>
  );
};

export default PersonalityPresets;
