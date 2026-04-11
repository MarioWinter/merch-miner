import { Box, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';

export const Section = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
}));

export const SectionLabel = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1.5),
}));

export const FieldRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1.5),
}));

export const FieldLabel = styled(Typography)({
  width: 32,
  flexShrink: 0,
});

export const WideFieldLabel = styled(Typography)({
  width: 56,
  flexShrink: 0,
});

export const SwitchRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(0.5, 0),
}));

export const ColorInput = styled('input')(({ theme }) => ({
  width: 32,
  height: 32,
  padding: 0,
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  backgroundColor: 'transparent',
  '&::-webkit-color-swatch-wrapper': { padding: 0 },
  '&::-webkit-color-swatch': {
    border: `1px solid ${alpha(theme.palette.common.white, 0.2)}`,
    borderRadius: 4,
  },
}));
