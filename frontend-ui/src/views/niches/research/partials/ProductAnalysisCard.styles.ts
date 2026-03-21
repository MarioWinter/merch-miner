import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { MONO_FONT_STACK } from '@/style/constants';

export const Card = styled(Box)(({ theme }) => ({
  background: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  wordBreak: 'break-word',
  transition: 'box-shadow 150ms ease',
  '&:hover': {
    boxShadow: `0 4px 16px rgba(0,0,0,0.30)`,
  },
}));

export const ProductHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  padding: theme.spacing(2, 2.5),
  position: 'relative',
}));

export const ThumbnailWrap = styled(Box)({
  width: 64,
  height: 64,
  borderRadius: 8,
  overflow: 'hidden',
  flexShrink: 0,
  position: 'relative',
  backgroundColor: 'rgba(255,255,255,0.04)',
});

export const Thumbnail = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  transform: 'scale(1.7)',
  objectPosition: 'center 35%',
});

export const ThumbnailPreview = styled(Box)(({ theme }) => ({
  position: 'absolute',
  left: 72,
  top: 0,
  zIndex: 1300,
  width: 280,
  height: 280,
  borderRadius: 12,
  overflow: 'hidden',
  background: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  transition: 'opacity 150ms ease',
  pointerEvents: 'none',
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
}));

export const HeaderLabel = styled(Typography)({
  fontSize: '0.6rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
} as const);

export const AsinText = styled(Typography)({
  fontFamily: MONO_FONT_STACK,
  fontSize: '0.75rem',
});

export const SectionLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: theme.vars.palette.text.secondary,
  marginBottom: theme.spacing(0.5),
}));

export const DetailSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0, 2.5, 2),
}));

export const FieldRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(0.5),
}));

export const FieldLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  fontWeight: 600,
  color: theme.vars.palette.text.secondary,
  minWidth: 100,
  flexShrink: 0,
}));

export const FieldValue = styled(Typography)({
  fontSize: '0.8125rem',
  wordBreak: 'break-word',
});
