/**
 * PROJ-20 Phase 3.6 — ModePopoverButton
 *
 * User-driven refactor 2026-04-28: Mode reduced to 2 cards (Chat / Agent).
 * The trigger button mirrors the active mode (icon + label + accent color),
 * not a static "Auto" placeholder. Selecting a card dispatches
 * `setModeOverride`, which the slice uses to bidirectionally sync the
 * drawer Tabs.
 *
 * AC-43: when Vane is offline, the Chat card is disabled (Chat = direct
 * Vane). Agent stays enabled (Agent uses its own backend pipeline).
 *
 * Color rules:
 *   - Chat  → secondary (#00C8D7 cyan, "Vane Intelligence" vibe)
 *   - Agent → primary (#FF5A4F red)
 */
import { memo, useState, type ComponentType, type MouseEvent } from 'react';
import {
  Box,
  ButtonBase,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import { styled, alpha, type Theme } from '@mui/material/styles';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setModeOverride } from '@/store/chatBarSlice';
import { useSearchHealth } from '../../../hooks/useSearchHealth';
import type { ModeOverride } from '@/types/search';
import type { SvgIconProps } from '@mui/material';

type ModeAccent = 'primary' | 'secondary';

interface ModeEntry {
  value: ModeOverride;
  labelKey: string;
  descriptionKey: string;
  Icon: ComponentType<SvgIconProps>;
  /** Accent palette key — drives card / trigger color. */
  accent: ModeAccent;
  /** AC-43: Chat (direct Vane) is gated on Vane health; Agent is not. */
  requiresVane: boolean;
}

const MODES: ModeEntry[] = [
  {
    value: 'chat',
    labelKey: 'search.mode.chat',
    descriptionKey: 'search.chatBar.modePopover.chat.description',
    Icon: ChatBubbleOutlineIcon,
    accent: 'secondary',
    requiresVane: true,
  },
  {
    value: 'agent',
    labelKey: 'search.mode.agent',
    descriptionKey: 'search.chatBar.modePopover.agent.description',
    Icon: SmartToyOutlinedIcon,
    accent: 'primary',
    requiresVane: false,
  },
];

/** Resolve an accent's hex from the theme palette (uses the live MUI value, not the CSS-var alias). */
const resolveAccentMain = (theme: Theme, accent: ModeAccent): string =>
  accent === 'secondary'
    ? theme.palette.secondary.main
    : theme.palette.primary.main;

/** Resolve an accent's CSS var (used for color rules — hot-swaps on color-scheme change). */
const resolveAccentVar = (theme: Theme, accent: ModeAccent): string =>
  accent === 'secondary'
    ? theme.vars.palette.secondary.main
    : theme.vars.palette.primary.main;

interface ModeButtonProps {
  accent: ModeAccent;
}

const ModeButton = styled(ButtonBase, {
  shouldForwardProp: (prop) => prop !== 'accent',
})<ModeButtonProps>(({ theme, accent }) => {
  const mainHex = resolveAccentMain(theme, accent);
  const mainVar = resolveAccentVar(theme, accent);
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    height: 32,
    padding: theme.spacing(0, 1.25),
    borderRadius: 8,
    color: mainVar,
    border: `1px solid ${theme.vars.palette.divider}`,
    backgroundColor: 'transparent',
    transition: 'background-color 150ms ease, color 150ms ease, border-color 150ms ease',
    '&:hover': {
      backgroundColor: alpha(mainHex, 0.08),
      borderColor: alpha(mainHex, 0.4),
    },
    '&:focus-visible': {
      outline: `2px solid ${mainVar}`,
      outlineOffset: 2,
    },
  };
});

const PopoverInner = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.75),
  minWidth: 280,
  maxWidth: 320,
}));

interface ModeCardProps {
  selected: boolean;
  disabled: boolean;
  accent: ModeAccent;
}

const ModeCard = styled(ButtonBase, {
  shouldForwardProp: (prop) =>
    prop !== 'selected' && prop !== 'disabled' && prop !== 'accent',
})<ModeCardProps>(({ theme, selected, disabled, accent }) => {
  const mainHex = resolveAccentMain(theme, accent);
  const mainVar = resolveAccentVar(theme, accent);
  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25),
    borderRadius: 10,
    textAlign: 'left',
    border: `1px solid ${selected ? mainVar : theme.vars.palette.divider}`,
    backgroundColor: selected ? alpha(mainHex, 0.08) : 'transparent',
    transition:
      'background-color 120ms ease, border-color 120ms ease, opacity 120ms ease',
    width: '100%',
    '&:hover': {
      backgroundColor: disabled
        ? 'transparent'
        : selected
          ? alpha(mainHex, 0.12)
          : theme.vars.palette.action.hover,
    },
    '&:focus-visible': {
      outline: `2px solid ${mainVar}`,
      outlineOffset: 2,
    },
    ...(disabled && {
      opacity: 0.5,
      pointerEvents: 'none',
    }),
  };
});

const OfflineBanner = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  padding: theme.spacing(0.75, 1),
  borderRadius: 8,
  border: `1px solid ${alpha(theme.palette.warning.main, 0.4)}`,
  backgroundColor: alpha(theme.palette.warning.main, 0.08),
  color: theme.vars.palette.warning.main,
  fontSize: '0.75rem',
}));

const ModePopoverButton = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const modeOverride = useAppSelector((s) => s.chatBar.modeOverride);
  const { vaneOnline } = useSearchHealth();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const activeMode = MODES.find((m) => m.value === modeOverride) ?? MODES[0];
  const ActiveIcon = activeMode.Icon;

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => setAnchorEl(null);

  const handleSelect = (mode: ModeOverride) => {
    dispatch(setModeOverride(mode));
    handleClose();
  };

  return (
    <>
      <ModeButton
        onClick={handleOpen}
        accent={activeMode.accent}
        data-testid="chat-input-mode-button"
        aria-label={t('search.chatBar.modePopover.ariaLabel')}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <ActiveIcon sx={{ fontSize: 16 }} />
        <Typography
          variant="body2"
          component="span"
          sx={{ fontWeight: 500, lineHeight: 1 }}
        >
          {t(activeMode.labelKey)}
        </Typography>
        <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
      </ModeButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        // PROJ-29 Phase 1J follow-up: disable scroll-lock — see SourcesPopoverButton.
        disableScrollLock
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            ...({ 'data-testid': 'chat-input-mode-popover' } as object),
            sx: { mt: -0.5, borderRadius: 2 },
          },
        }}
      >
        <PopoverInner>
          {!vaneOnline && (
            <OfflineBanner data-testid="chat-input-mode-vane-offline">
              <WarningAmberIcon sx={{ fontSize: 16 }} />
              <Box component="span">
                {t('search.chatBar.modePopover.vaneOffline')}
              </Box>
            </OfflineBanner>
          )}
          <Stack gap={0.75}>
            {MODES.map(
              ({ value, labelKey, descriptionKey, Icon, accent, requiresVane }) => {
                const disabled = requiresVane && !vaneOnline;
                const selected = value === modeOverride;
                return (
                  <ModeCard
                    key={value}
                    selected={selected}
                    disabled={disabled}
                    accent={accent}
                    onClick={() => handleSelect(value)}
                    data-testid={`chat-input-mode-card-${value}`}
                    aria-disabled={disabled}
                    aria-pressed={selected}
                  >
                    <Icon
                      sx={(theme) => ({
                        fontSize: 20,
                        mt: 0.25,
                        color: selected
                          ? resolveAccentVar(theme, accent)
                          : theme.vars.palette.text.secondary,
                      })}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, lineHeight: 1.3 }}
                      >
                        {t(labelKey)}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          display: 'block',
                          mt: 0.25,
                          lineHeight: 1.4,
                        }}
                      >
                        {t(descriptionKey)}
                      </Typography>
                    </Box>
                  </ModeCard>
                );
              },
            )}
          </Stack>
        </PopoverInner>
      </Popover>
    </>
  );
};

// Memo: this component has no props and reads everything from Redux
// selectors (incl. useSearchHealth). React.memo cuts cascading re-renders
// from the parent ChatInputBar/ChatPanel tree on every health-check poll.
export default memo(ModePopoverButton);
