import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import { DURATION, EASING } from '@/style/constants';

interface MainContentProps {
  $marginLeft: string;
}

export const MainContent = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$marginLeft',
})<MainContentProps>(({ theme, $marginLeft }) => ({
  flexGrow: 1,
  marginLeft: $marginLeft,
  marginTop: 56,
  minHeight: 'calc(100vh - 56px)',
  padding: theme.spacing(3),
  transition: `margin-left ${DURATION.default}ms ${EASING.standard}`,
}));
