/**
 * FIX-dashboard-bug-report-and-polish Item 9 — SearchDepthPicker.
 *
 * IconButton + Popover that lets the user pick the Vane `optimization_mode`
 * for the current chat session. Default `'speed'` (lowest cost). Switching
 * to `'balanced'` or `'quality'` shows a cost-warning snackbar once per
 * browser (gated by localStorage flag).
 *
 * Mirrors the visual + interaction pattern of ModelPopoverButton +
 * SourcesPopoverButton (Badge dot for non-default state, disableScrollLock
 * popover, tooltip on the IconButton).
 */
import { memo, useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import {
  Badge,
  Box,
  FormControlLabel,
  IconButton,
  Popover,
  Radio,
  RadioGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import SpeedIcon from '@mui/icons-material/Speed';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  DEFAULT_SEARCH_MODE,
  setSearchMode,
  SEARCH_MODES,
  type SearchMode,
} from '@/store/chatBarSlice';

const COST_WARNING_FLAG_KEY = 'chat-search-mode-cost-warning-seen';

const PopoverInner = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  padding: theme.spacing(1.25, 1.5),
  minWidth: 280,
  maxWidth: 320,
}));

const Title = styled(Typography)(({ theme }) => ({
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: theme.vars.palette.text.secondary,
  paddingBottom: theme.spacing(0.5),
}));

interface OptionRowProps {
  selected: boolean;
}

const OptionRow = styled(FormControlLabel, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<OptionRowProps>(({ theme, selected }) => ({
  margin: 0,
  alignItems: 'flex-start',
  borderRadius: 8,
  padding: theme.spacing(0.75, 1),
  transition: 'background-color 120ms ease',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.06),
  },
  ...(selected && {
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
  }),
  '& .MuiFormControlLabel-label': {
    marginLeft: theme.spacing(0.5),
  },
}));

const OptionLabel = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});

const QualityNote = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(0.75),
  marginTop: theme.spacing(0.75),
  padding: theme.spacing(0.75, 1),
  borderRadius: 8,
  backgroundColor: alpha(theme.palette.warning.main, 0.1),
  color: theme.vars.palette.warning.main,
}));

const OPTIONS: readonly SearchMode[] = SEARCH_MODES;

const hasSeenCostWarning = (): boolean => {
  if (typeof window === 'undefined' || !window.localStorage) return true;
  try {
    return window.localStorage.getItem(COST_WARNING_FLAG_KEY) === '1';
  } catch {
    return true;
  }
};

const markCostWarningSeen = (): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(COST_WARNING_FLAG_KEY, '1');
  } catch {
    /* quota / privacy — ignore */
  }
};

const SearchDepthPicker = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const searchMode = useAppSelector((s) => s.chatBar.searchMode);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  // useRef gate: only fire the cost-warning once per render lifecycle even if
  // localStorage flag is wiped mid-session.
  const costWarningFiredRef = useRef<boolean>(hasSeenCostWarning());

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => setAnchorEl(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value as SearchMode;
    if (!OPTIONS.includes(value)) return;
    dispatch(setSearchMode(value));
    if (value !== DEFAULT_SEARCH_MODE && !costWarningFiredRef.current) {
      costWarningFiredRef.current = true;
      markCostWarningSeen();
      enqueueSnackbar(t('search.chatBar.searchDepth.cost_warning'), {
        variant: 'warning',
      });
    }
  };

  const showBadge = searchMode !== DEFAULT_SEARCH_MODE;

  const currentLabel = useMemo(
    () => t(`search.chatBar.searchDepth.option_${searchMode}`),
    [searchMode, t],
  );

  return (
    <>
      <Tooltip
        title={t('search.chatBar.searchDepth.tooltip', { mode: currentLabel })}
      >
        <IconButton
          size="small"
          onClick={handleOpen}
          data-testid="chat-input-search-depth-button"
          data-active={showBadge ? 'true' : 'false'}
          aria-label={t('search.chatBar.searchDepth.ariaLabel')}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Badge
            color="secondary"
            variant="dot"
            invisible={!showBadge}
            data-testid="chat-input-search-depth-badge"
          >
            <SpeedIcon sx={{ fontSize: 20 }} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        disableScrollLock
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          paper: {
            ...({ 'data-testid': 'chat-input-search-depth-popover' } as object),
            sx: { mt: -0.5, borderRadius: 2 },
          },
        }}
      >
        <PopoverInner>
          <Title>{t('search.chatBar.searchDepth.title')}</Title>
          <RadioGroup
            value={searchMode}
            onChange={handleChange}
            name="chat-search-depth"
          >
            {OPTIONS.map((mode) => {
              const selected = mode === searchMode;
              return (
                <OptionRow
                  key={mode}
                  selected={selected}
                  value={mode}
                  control={
                    <Radio
                      size="small"
                      data-testid={`chat-input-search-depth-radio-${mode}`}
                    />
                  }
                  label={
                    <OptionLabel>
                      <Typography variant="body2" sx={{ fontWeight: selected ? 600 : 500 }}>
                        {t(`search.chatBar.searchDepth.option_${mode}`)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(`search.chatBar.searchDepth.hint_${mode}`)}
                      </Typography>
                    </OptionLabel>
                  }
                />
              );
            })}
          </RadioGroup>
          {searchMode === 'quality' && (
            <QualityNote data-testid="chat-input-search-depth-quality-warning">
              <WarningAmberRoundedIcon sx={{ fontSize: 16, mt: '2px' }} />
              <Typography variant="caption">
                {t('search.chatBar.searchDepth.warn_quality_long')}
              </Typography>
            </QualityNote>
          )}
        </PopoverInner>
      </Popover>
    </>
  );
};

export default memo(SearchDepthPicker);
