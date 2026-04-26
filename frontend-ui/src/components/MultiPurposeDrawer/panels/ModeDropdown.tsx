import { useState } from 'react';
import { FormControl, MenuItem, Select, Tooltip, type SelectChangeEvent } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setModeOverride } from '@/store/chatBarSlice';
import type { ModeOverride } from '@/types/search';

interface ModeDropdownProps {
  /** Optional compact size — used in floating bar (smaller footprint). */
  compact?: boolean;
}

const StyledSelect = styled(Select<ModeOverride>, {
  shouldForwardProp: (prop) => prop !== 'compact',
})<{ compact?: boolean }>(({ theme, compact }) => ({
  fontSize: compact ? '0.75rem' : '0.8125rem',
  height: compact ? 36 : 36,
  // Non-compact keeps a sized pill; compact lets the field shrink to its
  // content so it sits as inline text+caret next to the TextField with no
  // competing pill shape.
  minWidth: compact ? 'auto' : 130,
  color: theme.vars.palette.text.secondary,
  '& .MuiSelect-select': {
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(0.5),
    paddingLeft: compact ? theme.spacing(0.75) : theme.spacing(1),
    // Reserve room for the caret (24px) so renderValue contents never
    // slide under it.
    paddingRight: compact ? '24px' : '28px',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    minHeight: 'unset',
  },
  '& .MuiSelect-icon': {
    color: theme.vars.palette.text.secondary,
    ...(compact && { right: 2 }),
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderRadius: compact ? 0 : 16,
    ...(compact && {
      border: 'none',
    }),
  },
  '&:hover .MuiSelect-select': {
    color: theme.vars.palette.text.primary,
  },
}));

const MODES: { value: ModeOverride; labelKey: string; Icon: typeof AutoAwesomeIcon }[] = [
  { value: 'auto', labelKey: 'search.mode.auto', Icon: AutoAwesomeIcon },
  { value: 'web_search', labelKey: 'search.mode.webSearch', Icon: TravelExploreIcon },
  { value: 'agent', labelKey: 'search.mode.agent', Icon: SmartToyIcon },
];

const ModeDropdown = ({ compact = false }: ModeDropdownProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const modeOverride = useAppSelector((s) => s.chatBar.modeOverride);
  // Suppress tooltip while the Select menu is open — otherwise the tooltip
  // floats above the menu items and obscures them.
  const [menuOpen, setMenuOpen] = useState(false);

  const handleChange = (e: SelectChangeEvent<ModeOverride>) => {
    dispatch(setModeOverride(e.target.value as ModeOverride));
  };

  const renderValue = (value: ModeOverride) => {
    const mode = MODES.find((m) => m.value === value) ?? MODES[0];
    const { Icon } = mode;
    return (
      <>
        <Icon sx={{ fontSize: compact ? 14 : 16 }} />
        {t(mode.labelKey)}
      </>
    );
  };

  return (
    <Tooltip title={t('search.mode.tooltip')} placement="top" disableHoverListener={menuOpen} open={menuOpen ? false : undefined}>
      <FormControl size="small">
        <StyledSelect
          compact={compact}
          value={modeOverride}
          onChange={handleChange}
          onOpen={() => setMenuOpen(true)}
          onClose={() => setMenuOpen(false)}
          renderValue={renderValue}
          aria-label={t('search.mode.label')}
          MenuProps={{
            slotProps: {
              paper: { sx: { mt: 0.5 } },
            },
          }}
        >
          {MODES.map(({ value, labelKey, Icon }) => (
            <MenuItem key={value} value={value} sx={{ fontSize: '0.8125rem', gap: 1 }}>
              <Icon sx={{ fontSize: 16 }} />
              {t(labelKey)}
            </MenuItem>
          ))}
        </StyledSelect>
      </FormControl>
    </Tooltip>
  );
};

export default ModeDropdown;
