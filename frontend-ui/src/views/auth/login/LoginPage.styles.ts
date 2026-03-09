import { alpha, styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import { COLORS } from '../../../style/constants';

export const GoogleButton = styled(Button)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  borderColor: alpha(COLORS.ink, 0.20),
  color: theme.palette.text.primary,
  '&:hover': {
    backgroundColor: alpha(COLORS.ink, 0.04),
  },
  ...theme.applyStyles('dark', {
    borderColor: alpha(COLORS.white, 0.16),
    '&:hover': {
      backgroundColor: alpha(COLORS.white, 0.04),
    },
  }),
}));
