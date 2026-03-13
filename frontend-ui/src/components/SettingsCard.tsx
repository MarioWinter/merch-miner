import { alpha, styled } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import { COLORS } from '../style/constants';

/**
 * Reusable card wrapper used by all Settings section panels.
 * Provides consistent background, border, border-radius, and padding.
 */
export const SettingsCard = styled(Box)(({ theme }) => ({
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(2.5, 3),
  ...theme.applyStyles('dark', {
    backgroundColor: COLORS.inkPaper,
    border: `1px solid ${alpha(COLORS.white, 0.08)}`,
  }),
}));

interface SectionTitleProps {
  children: React.ReactNode;
}

/**
 * Section heading used inside SettingsCard panels.
 */
export const SectionTitle = ({ children }: SectionTitleProps) => {
  return (
    <Typography
      variant="h4"
      component="h2"
      sx={{ mb: 2.5, fontWeight: 600 }}
    >
      {children}
    </Typography>
  );
};
