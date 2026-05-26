// PROJ-34 Phase 13f part B — shared types + styled bits for the
// CustomSpatialCreator wizard. Extracted so the per-step files stay under
// the 250–300 line budget.

import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';

export type SourceSelection =
  | { kind: 'upload'; file: File; previewUrl: string }
  | { kind: 'reference'; id: string; previewUrl: string }
  | { kind: 'design'; id: string; previewUrl: string };

export const PreviewBox = styled(Box)(({ theme }) => ({
  width: 200,
  height: 200,
  borderRadius: 8,
  overflow: 'hidden',
  backgroundColor: theme.vars.palette.action.disabledBackground,
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
}));
