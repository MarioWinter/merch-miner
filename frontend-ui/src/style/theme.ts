import { alpha, extendTheme } from '@mui/material/styles';
import { COLORS } from './constants';

declare module '@mui/material/styles' {
  interface CssThemeVariables {
    enabled: true;
  }
  // Register `orange` as a first-class palette color so consumers can read
  // `theme.vars.palette.orange.main` (offline / degraded mode — distinct
  // from amber `warning`). See docs/design-system.md §2.1.
  interface Palette {
    orange: Palette['primary'];
  }
  interface PaletteOptions {
    orange?: PaletteOptions['primary'];
  }
  // PROJ-29 Phase 1H-1 — augment palette colours with a `subtle` slot.
  // Source-of-truth values defined in docs/design-system.md §2.1 / §2.2.
  // Use via `theme.vars.palette.primary.subtle` etc. inside styled() callbacks
  // — never hardcoded rgba in components.
  interface PaletteColor {
    subtle?: string;
  }
  interface SimplePaletteColorOptions {
    subtle?: string;
  }
  // PROJ-30 T1.2 — add `xxs: 400` as an ADDITIONAL named breakpoint (Plan B
  // per Phase 0 audit). `xs` stays at 0 so all 44 existing `xs:` Grid usages
  // remain semantically correct. `xxs` targets "tiny phones" (<400px) for
  // Hamburger-menu and other small-screen primitives.
  interface BreakpointOverrides {
    xxs: true;
  }
}

// PROJ-29 Phase 1H-1 — canonical `*.subtle` translucent backgrounds.
// Dark scheme: 0.10–0.12 alpha (sits on the dark-bluish canvas).
// Light scheme: 0.08–0.10 alpha (sits on near-white surfaces).
// docs/design-system.md §2.1 (dark) and §2.2 (light).
const SUBTLE_DARK = {
  primary: 'rgba(255, 90, 79, 0.12)',
  secondary: 'rgba(0, 200, 215, 0.10)',
  info: 'rgba(56, 189, 248, 0.10)',
  success: 'rgba(34, 211, 163, 0.12)',
  warning: 'rgba(245, 158, 11, 0.12)',
  error: 'rgba(244, 63, 58, 0.12)',
} as const;

const SUBTLE_LIGHT = {
  primary: 'rgba(255, 90, 79, 0.08)',
  secondary: 'rgba(0, 151, 167, 0.08)',
  info: 'rgba(2, 132, 199, 0.10)',
  success: 'rgba(5, 150, 105, 0.10)',
  warning: 'rgba(217, 119, 6, 0.10)',
  error: 'rgba(220, 38, 38, 0.10)',
} as const;

const theme = extendTheme({
  colorSchemeSelector: 'data-mui-color-scheme',
  // PROJ-30 T1.1 — Plan B breakpoints. `xxs: 400` is ADDED; `xs: 0` is
  // preserved so existing Grid `xs:` props (44 hits) keep their "0+" meaning.
  breakpoints: {
    values: {
      xxs: 400,
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"Inter", sans-serif',
    h1: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.20, letterSpacing: '-0.015em' },
    h3: { fontSize: '1.375rem', fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.01em' },
    h4: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.30, letterSpacing: '-0.005em' },
    h5: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.35, letterSpacing: 0 },
    h6: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.40, letterSpacing: 0 },
    body1: { fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.60 },
    body2: { fontSize: '0.8125rem', fontWeight: 400, lineHeight: 1.55 },
    subtitle1: { fontSize: '0.9375rem', fontWeight: 500, lineHeight: 1.50 },
    subtitle2: { fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.45, letterSpacing: '0.01em' },
    caption: { fontSize: '0.75rem', fontWeight: 400, lineHeight: 1.50, letterSpacing: '0.02em' },
    overline: { fontSize: '0.6875rem', fontWeight: 600, lineHeight: 1.40, letterSpacing: '0.08em' },
    button: {
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: '0.01em',
      textTransform: 'none',
    },
  },
  colorSchemes: {
    dark: {
      palette: {
        background: {
          default: COLORS.ink,
          paper: COLORS.inkPaper,
        },
        primary: {
          main: COLORS.red,
          dark: COLORS.redDk,
          light: COLORS.redLt,
          subtle: SUBTLE_DARK.primary,
        },
        secondary: {
          main: COLORS.cyan,
          dark: COLORS.cyanDk,
          light: COLORS.cyanLt,
          subtle: SUBTLE_DARK.secondary,
        },
        success: {
          main: COLORS.successDk,
          dark: COLORS.successDkShade,
          subtle: SUBTLE_DARK.success,
        },
        warning: {
          main: COLORS.warningDk,
          dark: COLORS.warningDkShade,
          subtle: SUBTLE_DARK.warning,
        },
        orange: {
          main: COLORS.orange,
          dark: COLORS.orangeShade,
          light: COLORS.orangeLight,
          contrastText: COLORS.white,
        },
        error: {
          main: COLORS.errorDk,
          dark: COLORS.errorDkShade,
          subtle: SUBTLE_DARK.error,
        },
        info: {
          main: COLORS.infoDk,
          subtle: SUBTLE_DARK.info,
        },
        text: {
          primary: COLORS.snow,
          secondary: COLORS.snowMuted,
          disabled: COLORS.snowDisabled,
        },
        divider: alpha('#fff', 0.08),
      },
    },
    light: {
      palette: {
        background: {
          default: COLORS.ashDefault,
          paper: COLORS.white,
        },
        primary: {
          main: COLORS.red,
          dark: COLORS.redDk,
          light: COLORS.redLt,
          subtle: SUBTLE_LIGHT.primary,
        },
        secondary: {
          main: COLORS.teal,
          dark: COLORS.tealDk,
          light: COLORS.tealLt,
          subtle: SUBTLE_LIGHT.secondary,
        },
        success: {
          main: COLORS.successLight,
          subtle: SUBTLE_LIGHT.success,
        },
        warning: {
          main: COLORS.warningLight,
          subtle: SUBTLE_LIGHT.warning,
        },
        orange: {
          main: COLORS.orangeShade,
          dark: COLORS.orangeShade,
          light: COLORS.orange,
          contrastText: COLORS.white,
        },
        error: {
          main: COLORS.errorLight,
          subtle: SUBTLE_LIGHT.error,
        },
        info: {
          main: COLORS.infoLight,
          subtle: SUBTLE_LIGHT.info,
        },
        text: {
          primary: COLORS.ink,
          secondary: COLORS.mist,
          disabled: COLORS.mistDisabled,
        },
        divider: alpha(COLORS.ink, 0.08),
      },
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        // PROJ-30 T1.4 — enforce 44×44 touch target on <md (mobile + tablet).
        // Desktop keeps existing 42px to avoid visual layout shift.
        root: ({ theme }) => ({
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          height: 42,
          [theme.breakpoints.down('md')]: {
            minHeight: 44,
          },
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        // PROJ-30 T1.4 — 44×44 hit area on <md. Visual icon size unchanged
        // (still controlled by the icon's `fontSize`); only the tap target grows.
        root: ({ theme }) => ({
          [theme.breakpoints.down('md')]: {
            minWidth: 44,
            minHeight: 44,
          },
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 12,
          border: `1px solid ${alpha(COLORS.ink, 0.08)}`,
          ...theme.applyStyles('dark', {
            border: `1px solid ${alpha('#fff', 0.08)}`,
          }),
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 8,
          backgroundColor: COLORS.ash,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(COLORS.ink, 0.18),
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(COLORS.ink, 0.30),
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.vars.palette.primary.main,
          },
          '&.Mui-disabled': {
            backgroundColor: alpha(COLORS.ash, 0.5),
          },
          ...theme.applyStyles('dark', {
            backgroundColor: COLORS.inkElevated,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha('#fff', 0.12),
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha('#fff', 0.22),
            },
            '&.Mui-disabled': {
              backgroundColor: alpha(COLORS.inkPaper, 0.5),
            },
          }),
        }),
        input: ({ theme }) => ({
          color: theme.vars.palette.text.primary,
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiDialog: {
      // PROJ-30 T1.3 — Note: the per-instance `fullScreen` prop is set by
      // <ResponsiveDialog> (a hook-based wrapper) since MUI defaultProps
      // cannot read media queries. The styleOverride below ensures fullscreen
      // dialogs render edge-to-edge without our `borderRadius: 16` rule
      // bleeding through.
      styleOverrides: {
        paper: {
          borderRadius: 16,
        },
        paperFullScreen: {
          borderRadius: 0,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: ({ theme }) => ({
          backgroundColor: COLORS.ashTooltip,
          color: COLORS.ink,
          fontSize: '0.8125rem',
          borderRadius: 6,
          ...theme.applyStyles('dark', {
            backgroundColor: COLORS.inkElevated,
            color: COLORS.snow,
          }),
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderBottom: `1px solid ${theme.vars.palette.divider}`,
          padding: '8px 16px',
        }),
        head: {
          fontWeight: 600,
          fontSize: '0.6875rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          height: 44,
          '&:last-child td': {
            borderBottom: 0,
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          gap: 4,
        },
        grouped: ({ theme }) => ({
          borderRadius: '8px !important',
          border: `1px solid ${alpha(COLORS.ink, 0.12)} !important`,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          padding: '6px 16px',
          ...theme.applyStyles('dark', {
            border: `1px solid ${alpha('#fff', 0.12)} !important`,
          }),
        }),
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          height: 42,
          color: theme.vars.palette.text.secondary,
          '&.Mui-selected': {
            color: theme.vars.palette.primary.main,
            backgroundColor: alpha(COLORS.red, 0.08),
            '&:hover': {
              backgroundColor: alpha(COLORS.red, 0.14),
            },
          },
          ...theme.applyStyles('dark', {
            '&.Mui-selected': {
              backgroundColor: alpha(COLORS.red, 0.12),
              '&:hover': {
                backgroundColor: alpha(COLORS.red, 0.18),
              },
            },
          }),
        }),
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: alpha(COLORS.red, 0.12),
          color: theme.vars.palette.primary.main,
          border: `1px solid ${theme.vars.palette.primary.main}`,
        }),
      },
    },
  },
});

export default theme;
