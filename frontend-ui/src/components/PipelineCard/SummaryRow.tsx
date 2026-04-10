import { Stack } from '@mui/material';
import { styled } from '@mui/material/styles';
import { DURATION, EASING } from '@/style/constants';

/**
 * Shared summary row for pipeline content cards (Listings, Upload, etc.).
 * Horizontal row with icon, label, and value.
 */
export const SummaryRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.shape.borderRadius * 0.75,
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}`,
}));

export const CountValue = styled('span')(({ theme }) => ({
  ...theme.typography.subtitle2,
  fontWeight: 600,
  minWidth: 20,
  textAlign: 'right',
}));
