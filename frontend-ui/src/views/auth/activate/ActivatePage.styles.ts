import { alpha, styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import { COLORS } from '../../../style/constants';

interface StatusIconBoxProps {
  $success?: boolean;
}

export const StatusIconBox = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$success',
})<StatusIconBoxProps>(({ $success }) => ({
  width: 64,
  height: 64,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  backgroundColor: $success
    ? alpha(COLORS.successDk, 0.12)
    : alpha(COLORS.errorDk, 0.12),
}));
