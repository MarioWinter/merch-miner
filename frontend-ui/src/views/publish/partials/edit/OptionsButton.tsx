import { useCallback, useState } from 'react';
import { Button } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const StyledButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'rotated',
})<{ rotated: boolean }>(({ theme, rotated }) => ({
  minWidth: 0,
  padding: theme.spacing(0.25, 0.75),
  color: theme.vars.palette.text.disabled,
  textTransform: 'none',
  fontSize: theme.typography.caption.fontSize,
  fontWeight: theme.typography.caption.fontWeight,
  lineHeight: 1.2,
  gap: theme.spacing(0.5),
  borderRadius: Number(theme.shape.borderRadius),
  transition: `color ${DURATION.fast}ms ${EASING.standard}, background-color ${DURATION.fast}ms ${EASING.standard}`,
  '& .MuiButton-startIcon': {
    marginRight: theme.spacing(0.5),
    marginLeft: 0,
    transition: `transform ${DURATION.fast}ms ${EASING.standard}`,
    transform: rotated ? 'rotate(90deg)' : 'rotate(0deg)',
  },
  '&:hover': {
    color: COLORS.cyan,
    backgroundColor: alpha(COLORS.cyan, 0.08),
  },
  '&:focus-visible': {
    outline: `2px solid ${alpha(COLORS.cyan, 0.6)}`,
    outlineOffset: 2,
  },
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OptionsButtonProps {
  onClick?: () => void;
  ariaLabel?: string;
}

const OptionsButton = ({ onClick, ariaLabel }: OptionsButtonProps) => {
  const { t } = useTranslation();
  const [rotated, setRotated] = useState(false);

  const handleClick = useCallback(() => {
    setRotated((prev) => !prev);
    onClick?.();
  }, [onClick]);

  const label = t('publish.edit.options', { defaultValue: 'Options' });

  return (
    <StyledButton
      type="button"
      size="small"
      variant="text"
      rotated={rotated}
      onClick={handleClick}
      startIcon={<SettingsOutlinedIcon sx={{ fontSize: 14 }} />}
      aria-label={ariaLabel ?? label}
    >
      {label}
    </StyledButton>
  );
};

export default OptionsButton;
