import { Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const OverlayButton = styled(Button)(({ theme }) => ({
  position: 'absolute',
  zIndex: 100,
  pointerEvents: 'auto',
  minWidth: 130,
  background: `linear-gradient(135deg, ${theme.vars.palette.primary.main} 0%, ${theme.vars.palette.primary.dark} 100%)`,
  color: theme.vars.palette.common.white,
  fontSize: 13,
  fontWeight: 600,
  textTransform: 'none',
  borderRadius: 8,
  padding: '6px 16px',
  '&:hover': {
    background: `linear-gradient(135deg, ${theme.vars.palette.primary.dark} 0%, ${theme.vars.palette.primary.main} 100%)`,
  },
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface RegenerateOverlayProps {
  /** Screen X coordinate (center of artboard) */
  screenX: number;
  /** Screen Y coordinate (below artboard frame) */
  screenY: number;
  onRegenerate: () => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const RegenerateOverlay = ({ screenX, screenY, onRegenerate }: RegenerateOverlayProps) => {
  const { t } = useTranslation();

  return (
    <OverlayButton
      variant="contained"
      size="small"
      startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
      onClick={onRegenerate}
      style={{
        left: screenX,
        top: screenY,
        transform: 'translateX(-50%)',
      }}
      aria-label={t('design.board.regenerate', 'Regenerate')}
    >
      {t('design.board.regenerate', 'Regenerate')}
    </OverlayButton>
  );
};

export default RegenerateOverlay;
