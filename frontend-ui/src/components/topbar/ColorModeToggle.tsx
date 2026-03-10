import { Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { useColorScheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

const TopbarIconButton = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: '8px',
  color: theme.vars.palette.text.secondary,
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
    color: theme.vars.palette.text.primary,
  },
}));

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
      <TopbarIconButton
        onClick={toggleMode}
        size="small"
        aria-label={label}
      >
        <Icon sx={{ fontSize: 20 }} />
      </TopbarIconButton>
    </Tooltip>
  );
};

export default ColorModeToggle;
