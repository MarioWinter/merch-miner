import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { alpha, styled, useTheme } from '@mui/material/styles';

interface SectionLabelProps {
  icon?: ReactNode;
  label: string;
  count?: number;
  children?: ReactNode;
  /** Palette path like "secondary.main" or a hex color like "#00C8D7" */
  iconColor?: string;
}

const IconBox = styled(Box)({
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
  flexShrink: 0,
  '& svg': {
    fontSize: 16,
    color: 'inherit',
  },
});

const LabelText = styled(Typography)(({ theme }) => ({
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: theme.vars.palette.text.secondary,
}));

const CountBadge = styled(Typography)(({ theme }) => ({
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: theme.vars.palette.text.disabled,
}));

const resolvePaletteColor = (palette: Record<string, unknown>, path: string): string | null => {
  const parts = path.split('.');
  let current: unknown = palette;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return typeof current === 'string' ? current : null;
};

export const SectionLabel = ({
  icon,
  label,
  count,
  children,
  iconColor,
}: SectionLabelProps) => {
  const theme = useTheme();

  const resolvedColor = iconColor
    ? (iconColor.startsWith('#') || iconColor.startsWith('rgb')
      ? iconColor
      : resolvePaletteColor(theme.palette as unknown as Record<string, unknown>, iconColor) ?? theme.palette.text.secondary)
    : theme.palette.text.secondary;

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ mb: 1 }}
    >
      {icon && (
        <IconBox
          sx={{
            backgroundColor: alpha(resolvedColor, 0.14),
            color: resolvedColor,
          }}
        >
          {icon}
        </IconBox>
      )}
      <LabelText>{label}</LabelText>
      {count != null && <CountBadge>({count})</CountBadge>}
      {children && (
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
          {children}
        </Box>
      )}
    </Stack>
  );
};
