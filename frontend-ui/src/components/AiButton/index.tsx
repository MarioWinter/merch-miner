import { alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import Button from '@mui/material/Button';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { COLORS } from '@/style/constants';

interface AiButtonProps {
  label?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  sx?: SxProps<Theme>;
}

export const AiButton = ({
  label = 'Deep Drill',
  onClick,
  type = 'button',
  disabled = false,
  id,
  ariaLabel,
  sx,
}: AiButtonProps) => (
  <Button
    variant="outlined"
    color="primary"
    startIcon={<AutoAwesomeIcon />}
    onClick={onClick}
    type={type}
    disabled={disabled}
    id={id}
    aria-label={ariaLabel ?? label}
    sx={{
      borderColor: alpha(COLORS.red, 0.30),
      '&:hover': { backgroundColor: alpha(COLORS.red, 0.08) },
      ...((sx ?? {}) as object),
    }}
  >
    {label}
  </Button>
);
