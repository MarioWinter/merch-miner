import { Box, Chip, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { COLORS, DURATION, EASING } from '@/style/constants';

export const SectionCard = styled(Box)<{ disabled?: boolean }>(({ theme, disabled }) => ({
  backgroundColor: alpha(COLORS.inkElevated, 0.40),
  borderRadius: 8,
  padding: theme.spacing(2),
  transition: `opacity ${DURATION.default}ms ${EASING.standard}, filter ${DURATION.default}ms ${EASING.standard}`,
  ...(disabled && {
    '& > *:not(:first-of-type)': {
      opacity: 0.45,
      filter: 'blur(1px)',
      pointerEvents: 'none',
    },
  }),
  ...theme.applyStyles('light', {
    backgroundColor: alpha(COLORS.ash, 0.6),
  }),
}));

export const SectionHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

export const KeywordChip = styled(Chip)(({ theme }) => ({
  borderColor: alpha(COLORS.cyan, 0.20),
  '&.MuiChip-colorSecondary': {
    borderColor: COLORS.cyan,
    backgroundColor: alpha(COLORS.cyan, 0.10),
  },
  ...theme.applyStyles('light', {
    borderColor: alpha(COLORS.teal, 0.25),
    '&.MuiChip-colorSecondary': {
      borderColor: COLORS.teal,
      backgroundColor: alpha(COLORS.teal, 0.08),
    },
  }),
}));

export const ResearchRow = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '20px 100px 1fr',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 0),
}));

export const ResearchLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.caption,
  textAlign: 'right',
  color: theme.vars.palette.text.secondary,
}));

export const ProductThumb = styled('img')<{ selected?: boolean }>(({ selected }) => ({
  width: 56,
  height: 56,
  objectFit: 'cover',
  borderRadius: 6,
  cursor: 'pointer',
  border: selected ? `2px solid ${COLORS.cyan}` : '2px solid transparent',
  boxShadow: selected ? `0 0 8px ${alpha(COLORS.cyan, 0.3)}` : 'none',
  transition: `border ${DURATION.fast}ms ${EASING.standard}, box-shadow ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    border: `2px solid ${alpha(COLORS.cyan, 0.5)}`,
  },
}));
