import type { ReactNode } from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';
import { styled } from '@mui/material/styles';

interface SectionCardProps {
  children: ReactNode;
  sx?: SxProps<Theme>;
}

const Root = styled(Box)(({ theme }) => ({
  background: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(2.5, 3),
  wordBreak: 'break-word',
}));

export const SectionCard = ({ children, sx }: SectionCardProps) => (
  <Root sx={sx}>{children}</Root>
);
