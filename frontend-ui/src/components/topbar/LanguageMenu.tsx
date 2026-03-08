import { useState } from 'react';
import { IconButton, ListItemIcon, Menu, MenuItem, Tooltip } from '@mui/material';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import CheckIcon from '@mui/icons-material/Check';
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
        <IconButton
          onClick={handleOpen}
          size="small"
          aria-label={label}
          aria-controls={open ? 'language-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          sx={ICON_BUTTON_SX}
        >
          <TranslateOutlinedIcon sx={{ fontSize: 20 }} />
        </IconButton>
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
