import { alpha, extendTheme } from '@mui/material/styles';
import { COLORS } from './constants';

declare module '@mui/material/styles' {
  interface CssThemeVariables {
    enabled: true;
  }
}

const theme = extendTheme({
  colorSchemeSelector: 'data-mui-color-scheme',
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
        },
        secondary: {
          main: COLORS.cyan,
          dark: COLORS.cyanDk,
          light: COLORS.cyanLt,
        },
        success: {
          main: COLORS.successDk,
          dark: COLORS.successDkShade,
        },
        warning: {
          main: COLORS.warningDk,
          dark: COLORS.warningDkShade,
        },
        error: {
          main: COLORS.errorDk,
          dark: COLORS.errorDkShade,
        },
        info: {
          main: COLORS.infoDk,
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
        },
        secondary: {
          main: COLORS.teal,
          dark: COLORS.tealDk,
          light: COLORS.tealLt,
        },
        success: {
          main: COLORS.successLight,
        },
        warning: {
          main: COLORS.warningLight,
        },
        error: {
          main: COLORS.errorLight,
        },
        info: {
          main: COLORS.infoLight,
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
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          height: 42,
        },
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
      styleOverrides: {
        paper: {
          borderRadius: 16,
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
