// PROJ-34 Phase 13t-m — shared types + styled bits for the
// CustomTypographyCreator wizard. Mirrors CustomSpatialCreator.shared.tsx 1:1
// — see Appendix N. Extracted so the per-step files stay under the 250–300
// line budget.

import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';

/** One-of source for the analyze step (Upload | Reference | Design). */
export type ImageSource = 'upload' | 'reference' | 'design';

export type SourceSelection =
  | { kind: 'upload'; file: File; previewUrl: string }
  | { kind: 'reference'; id: string; previewUrl: string }
  | { kind: 'design'; id: string; previewUrl: string };

/** Draft state aggregated across the 3 wizard steps before the
 *  `createCustomTypography` mutation fires. */
export interface CustomTypographyDraft {
  source: SourceSelection | null;
  promptText: string;
  name: string;
}

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
