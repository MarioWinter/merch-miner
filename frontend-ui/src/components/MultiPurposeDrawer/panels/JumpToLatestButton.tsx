import { Button } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import { useTranslation } from 'react-i18next';

interface JumpToLatestButtonProps {
  onClick: () => void;
  visible: boolean;
}

const FloatingButton = styled(Button)(({ theme }) => ({
  position: 'absolute',
  bottom: theme.spacing(2),
  right: theme.spacing(2),
  zIndex: 2,
  textTransform: 'none',
  fontSize: '0.75rem',
  fontWeight: 500,
  padding: `${theme.spacing(0.5)} ${theme.spacing(1.25)}`,
  borderRadius: 16,
  backgroundColor: alpha(theme.palette.background.paper, 0.92),
  backdropFilter: 'blur(8px)',
  border: `1px solid ${theme.vars.palette.divider}`,
  boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.25)}`,
  color: theme.vars.palette.text.primary,
  '&:hover': {
    backgroundColor: theme.vars.palette.background.paper,
  },
}));

const JumpToLatestButton = ({ onClick, visible }: JumpToLatestButtonProps) => {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <FloatingButton
      onClick={onClick}
      startIcon={<KeyboardDoubleArrowDownIcon sx={{ fontSize: 16 }} />}
      aria-label={t('search.scroll.jumpToLatest')}
    >
      {t('search.scroll.jumpToLatest')}
    </FloatingButton>
  );
};

export default JumpToLatestButton;
