import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

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
  width: 56,
  flexShrink: 0,
});

export const ColorInput = styled('input')({
  width: 32,
  height: 32,
  padding: 0,
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  backgroundColor: 'transparent',
  '&::-webkit-color-swatch-wrapper': { padding: 0 },
  '&::-webkit-color-swatch': { borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)' },
});
