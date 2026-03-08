import { IconButton, Tooltip } from '@mui/material';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { useColorScheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

const ICON_BUTTON_SX = {
  width: 32,
  height: 32,
  borderRadius: '8px',
  color: 'text.secondary',
  '&:hover': {
    bgcolor: 'action.hover',
    color: 'text.primary',
  },
} as const;

const ColorModeToggle = () => {
  const { mode, setMode } = useColorScheme();
  const { t } = useTranslation();

  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleMode = () => {
    setMode(isDark ? 'light' : 'dark');
  };

  const Icon = isDark ? DarkModeOutlinedIcon : LightModeOutlinedIcon;
  const label = isDark ? t('topbar.darkMode') : t('topbar.lightMode');

  return (
    <Tooltip title={label}>
      <IconButton
        onClick={toggleMode}
        size="small"
        aria-label={label}
        sx={ICON_BUTTON_SX}
      >
        <Icon sx={{ fontSize: 20 }} />
      </IconButton>
    </Tooltip>
  );
};

export default ColorModeToggle;
