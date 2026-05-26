// PROJ-34 Phase 8 — footer counter + Build CTA (AC-34, AC-36).

import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { COLORS } from '@/style/constants';

interface BuildCounterProps {
  sloganCount: number;
  styleCount: number;
  isBuilding: boolean;
  onBuild: () => void;
}

const Footer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  padding: theme.spacing(2, 3),
  borderTop: `1px solid ${theme.vars.palette.divider}`,
}));

const CountText = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.vars.palette.text.secondary,
  '& strong': {
    color: theme.vars.palette.secondary.main,
    fontWeight: 700,
  },
}));

const BuildButton = styled(Button)(() => ({
  backgroundColor: COLORS.cyan,
  color: COLORS.ink,
  fontWeight: 600,
  borderRadius: 8,
  '&:hover': {
    backgroundColor: COLORS.cyanDk,
    boxShadow: `0 0 16px ${alpha(COLORS.cyan, 0.35)}`,
  },
  '&.Mui-disabled': { opacity: 0.5, color: COLORS.ink },
}));

const BuildCounter = ({ sloganCount, styleCount, isBuilding, onBuild }: BuildCounterProps) => {
  // PROJ-34 Phase 13t-u: Style is now optional. Slogan-only build uses a
  // neutral fallback style (server-side _fallback_style) so the user can
  // ship prompts quickly without picking from the style library.
  const effectiveStyleCount = Math.max(styleCount, 1);
  const total = sloganCount * effectiveStyleCount;
  const ready = sloganCount > 0;

  return (
    <Footer>
      {ready ? (
        <CountText>
          Will generate <strong>{total}</strong> prompts ({sloganCount} slogans
          × {effectiveStyleCount} {styleCount > 0 ? 'styles' : 'style'})
          {styleCount === 0 && (
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              sx={{ ml: 1 }}
            >
              · using neutral default style
            </Typography>
          )}
        </CountText>
      ) : (
        <Typography variant="body2" color="text.disabled">
          Select at least one slogan
        </Typography>
      )}
      <BuildButton
        startIcon={
          isBuilding ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <AutoAwesomeIcon sx={{ fontSize: 18 }} />
          )
        }
        onClick={onBuild}
        disabled={!ready || isBuilding}
      >
        {ready ? `Build ${total} prompts` : 'Build'}
      </BuildButton>
    </Footer>
  );
};

export default BuildCounter;
