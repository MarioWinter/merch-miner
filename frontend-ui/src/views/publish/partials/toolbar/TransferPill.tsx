import { Box, Typography } from '@mui/material';
import { alpha, styled, keyframes } from '@mui/material/styles';
import { COLORS, DURATION, EASING } from '@/style/constants';

interface TransferPillProps {
  count: number;
  visible: boolean;
  onClick: () => void;
}

const fadeInScale = keyframes`
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const PillRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'visible',
})<{ visible: boolean }>(({ theme, visible }) => ({
  display: visible ? 'inline-flex' : 'none',
  alignItems: 'center',
  backgroundColor: alpha(COLORS.cyan, 0.15),
  border: `1px solid ${alpha(COLORS.cyan, 0.3)}`,
  borderRadius: Number(theme.shape.borderRadius) * 2,
  padding: theme.spacing(0.25, 1),
  cursor: 'pointer',
  animation: `${fadeInScale} ${DURATION.fast}ms ${EASING.enter}`,
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: alpha(COLORS.cyan, 0.25),
  },
}));

const TransferPill = ({ count, visible, onClick }: TransferPillProps) => {
  if (!visible || count <= 0) return null;

  return (
    <PillRoot
      visible={visible}
      onClick={onClick}
      role="button"
      aria-label={`Transfer ${count} items`}
    >
      <Typography variant="caption" sx={{ color: COLORS.cyan, fontWeight: 600 }}>
        &rarr;{count}&rarr;
      </Typography>
    </PillRoot>
  );
};

export default TransferPill;
