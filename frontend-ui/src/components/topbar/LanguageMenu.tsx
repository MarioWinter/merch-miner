import { useState } from 'react';
import { ListItemIcon, Menu, MenuItem, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';

const TopbarIconButton = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: '8px',
  color: theme.vars?.palette.text.secondary ?? theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: theme.vars?.palette.action.hover ?? theme.palette.action.hover,
    color: theme.vars?.palette.text.primary ?? theme.palette.text.primary,
  },
}));

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it'] as const;

const LanguageMenu = () => {
  const { i18n, t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code);
    handleClose();
  };

  const label = t('topbar.language');

  return (
    <>
      <Tooltip title={label}>
        <TopbarIconButton
          onClick={handleOpen}
          size="small"
          aria-label={label}
          aria-controls={open ? 'language-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
        >
          <TranslateOutlinedIcon sx={{ fontSize: 20 }} />
        </TopbarIconButton>
      </Tooltip>
      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {LANGUAGES.map((code) => (
          <MenuItem
            key={code}
            onClick={() => handleSelect(code)}
            selected={i18n.language === code}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              {i18n.language === code && <CheckIcon sx={{ fontSize: 18 }} />}
            </ListItemIcon>
            {t(`topbar.languages.${code}`)}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LanguageMenu;
