import { Button, Checkbox, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';

interface SelectCounterProps {
  selectedCount: number;
  totalCount: number;
  hasSelection: boolean;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

const CounterButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'hasSelection',
})<{ hasSelection: boolean }>(({ theme, hasSelection }) => ({
  height: theme.spacing(4),
  minWidth: theme.spacing(10),
  textTransform: 'none',
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  ...(hasSelection && {
    borderColor: alpha(COLORS.cyan, 0.3),
    color: COLORS.cyan,
    backgroundColor: alpha(COLORS.cyan, 0.06),
    '&:hover': {
      borderColor: alpha(COLORS.cyan, 0.5),
      backgroundColor: alpha(COLORS.cyan, 0.1),
    },
  }),
}));

const SelectCounter = ({
  selectedCount,
  totalCount,
  hasSelection,
  onSelectAll,
  onSelectNone,
}: SelectCounterProps) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  return (
    <>
      <CounterButton
        variant="outlined"
        size="small"
        hasSelection={hasSelection}
        onClick={handleOpen}
        startIcon={
          <Checkbox
            checked={hasSelection && selectedCount === totalCount}
            indeterminate={hasSelection && selectedCount < totalCount}
            size="small"
            sx={{ p: 0 }}
            color="secondary"
            data-no-lasso
          />
        }
        endIcon={<ArrowDropDownIcon />}
        aria-label={t('publish.toolbar.selectCounter', { defaultValue: 'Select designs' })}
      >
        {selectedCount}/{totalCount}
      </CounterButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <MenuItem
          onClick={() => {
            onSelectAll();
            handleClose();
          }}
        >
          <ListItemIcon>
            <CheckCircleOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('publish.toolbar.selectAll', { defaultValue: 'Select All' })}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            onSelectNone();
            handleClose();
          }}
          disabled={!hasSelection}
        >
          <ListItemIcon>
            <RadioButtonUncheckedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('publish.toolbar.selectNone', { defaultValue: 'Select None' })}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default SelectCounter;
