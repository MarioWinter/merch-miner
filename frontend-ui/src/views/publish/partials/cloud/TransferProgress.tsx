import { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { COLORS, DURATION, EASING } from '@/style/constants';

interface TransferProgressProps {
  /** 'idle' | 'transferring' | 'done' */
  status: 'idle' | 'transferring' | 'done';
}

const Overlay = styled(Box)({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 3,
  backgroundColor: alpha(COLORS.ink, 0.5),
  transition: `opacity ${DURATION.default}ms ${EASING.standard}`,
});

const TransferProgress = ({ status }: TransferProgressProps) => {
  const [doneTimedOut, setDoneTimedOut] = useState(false);

  // Auto-hide after done; reset on any status change via cleanup
  useEffect(() => {
    if (status === 'done') {
      const timer = setTimeout(() => setDoneTimedOut(true), 1500);
      return () => clearTimeout(timer);
    }
    // Reset via setTimeout to avoid synchronous setState in effect
    const t = setTimeout(() => setDoneTimedOut(false), 0);
    return () => clearTimeout(t);
  }, [status]);

  const show = status !== 'idle' && !(status === 'done' && doneTimedOut);

  if (!show) return null;

  return (
    <Overlay sx={{ opacity: show ? 1 : 0 }}>
      {status === 'transferring' && (
        <CircularProgress
          size={40}
          sx={{ color: COLORS.cyan }}
        />
      )}
      {status === 'done' && (
        <CheckCircleIcon sx={{ fontSize: 40, color: COLORS.successDk }} />
      )}
    </Overlay>
  );
};

export default TransferProgress;
