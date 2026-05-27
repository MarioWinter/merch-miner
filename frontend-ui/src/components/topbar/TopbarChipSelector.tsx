/**
 * Reusable pill-chip dropdown for the topbar (workspace, niche, …). Same
 * visual language across instances: outlined pill + chevron + MUI Menu.
 */
import { useState, type MouseEvent } from 'react';
import { Menu, MenuItem, Skeleton, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CheckIcon from '@mui/icons-material/Check';

export interface ChipOption {
  id: string;
  label: string;
}

interface TopbarChipSelectorProps {
  value: string | null;
  placeholder: string;
  options: ChipOption[];
  onChange: (id: string) => void;
  loading?: boolean;
  emptyLabel?: string;
  ariaLabel?: string;
  menuId: string;
  testId?: string;
}

const ChipButton = styled(Button)(({ theme }) => ({
  borderRadius: '999px',
  color: theme.vars.palette.text.secondary,
  textTransform: 'none',
  borderColor: theme.vars.palette.text.secondary,
  fontWeight: 500,
  paddingLeft: 16,
  paddingRight: 16,
  height: 32,
  whiteSpace: 'nowrap',
  maxWidth: 300,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
    color: theme.vars.palette.text.primary,
  },
}));

const TopbarChipSelector = ({
  value,
  placeholder,
  options,
  onChange,
  loading = false,
  emptyLabel,
  ariaLabel,
  menuId,
  testId,
}: TopbarChipSelectorProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  if (loading) {
    return (
      <Skeleton
        variant="rounded"
        width={140}
        height={32}
        sx={{ borderRadius: '999px' }}
        aria-label={ariaLabel ?? placeholder}
      />
    );
  }

  const active = options.find((o) => o.id === value);
  const buttonLabel = active?.label ?? placeholder;

  return (
    <>
      <ChipButton
        variant="outlined"
        size="small"
        endIcon={<KeyboardArrowDownIcon />}
        onClick={(e: MouseEvent<HTMLButtonElement>) => setAnchorEl(e.currentTarget)}
        aria-controls={open ? menuId : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        aria-label={ariaLabel ?? placeholder}
        data-testid={testId}
      >
        {buttonLabel}
      </ChipButton>
      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'center', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
        slotProps={{ paper: { sx: { minWidth: 180, mt: 0.5 } } }}
      >
        {options.length === 0 ? (
          <MenuItem disabled>{emptyLabel ?? placeholder}</MenuItem>
        ) : (
          options.map((opt) => (
            <MenuItem
              key={opt.id}
              selected={opt.id === value}
              onClick={() => {
                onChange(opt.id);
                setAnchorEl(null);
              }}
              sx={{ gap: 1 }}
            >
              <CheckIcon
                fontSize="small"
                sx={{
                  visibility: opt.id === value ? 'visible' : 'hidden',
                  color: 'primary.main',
                }}
              />
              {opt.label}
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
};

export default TopbarChipSelector;
