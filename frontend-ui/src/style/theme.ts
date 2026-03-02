import { extendTheme } from '@mui/material/styles';

const theme = extendTheme({
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
          default: '#071E26',
          paper: '#0B2731',
        },
        primary: {
          main: '#FF5A4F',
          dark: '#E84B42',
          light: '#FF7A72',
        },
        secondary: {
          main: '#00C8D7',
          dark: '#00A8B5',
          light: '#33D5E2',
        },
        success: {
          main: '#22D3A3',
          dark: '#18B08A',
        },
        warning: {
          main: '#F59E0B',
          dark: '#D97706',
        },
        error: {
          main: '#F43F3A',
          dark: '#D93530',
        },
        info: {
          main: '#38BDF8',
        },
        text: {
          primary: '#E8F4F8',
          secondary: '#7BAAB8',
          disabled: '#3D6A7A',
        },
        divider: 'rgba(255,255,255,0.08)',
      },
    },
    light: {
      palette: {
        background: {
          default: '#F0F6F8',
          paper: '#FFFFFF',
        },
        primary: {
          main: '#FF5A4F',
          dark: '#E84B42',
          light: '#FF7A72',
        },
        secondary: {
          main: '#0097A7',
          dark: '#00838F',
          light: '#00BCD4',
        },
        success: {
          main: '#059669',
        },
        warning: {
          main: '#D97706',
        },
        error: {
          main: '#DC2626',
        },
        info: {
          main: '#0284C7',
        },
        text: {
          primary: '#071E26',
          secondary: '#3D6A7A',
          disabled: '#8AADB8',
        },
        divider: 'rgba(7,30,38,0.08)',
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
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 12,
          border: `1px solid ${
            theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(7,30,38,0.08)'
          }`,
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
        root: {
          borderRadius: 8,
        },
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
          backgroundColor:
            theme.palette.mode === 'dark' ? '#0F3040' : '#F7FBFC',
          color:
            theme.palette.mode === 'dark' ? '#E8F4F8' : '#071E26',
          fontSize: '0.8125rem',
          borderRadius: 6,
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '8px 16px',
        },
        head: {
          fontWeight: 600,
          fontSize: '0.6875rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        },
      },
    },
  },
});

export default theme;
