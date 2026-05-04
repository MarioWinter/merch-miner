import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { BackgroundColor } from '../types';

const BG_COLORS: Record<BackgroundColor, string> = {
  light_gray: '#D3D3D3',
  neon_pink: '#FF6EC7',
  neon_green: '#39FF14',
};

interface BackgroundColorPickerProps {
  value: BackgroundColor;
  onChange: (color: BackgroundColor) => void;
  disabled?: boolean;
}

const ColorSwatch = styled(Box)({
  width: 20,
  height: 20,
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.2)',
  marginRight: 6,
});

export const BackgroundColorPicker = ({
  value,
  onChange,
  disabled,
}: BackgroundColorPickerProps) => {
  const { t } = useTranslation();

  const handleChange = (_: React.MouseEvent<HTMLElement>, newValue: string | null) => {
    if (newValue) onChange(newValue as BackgroundColor);
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {t('design.background.label')}
      </Typography>
      <ToggleButtonGroup
        value={value}
        exclusive
        onChange={handleChange}
        size="small"
        disabled={disabled}
        aria-label={t('design.background.label')}
      >
        {(Object.keys(BG_COLORS) as BackgroundColor[]).map((color) => (
          <ToggleButton key={color} value={color} aria-label={t(`design.background.${color}`)}>
            <ColorSwatch sx={{ bgcolor: BG_COLORS[color] }} />
            {t(`design.background.${color}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
};
