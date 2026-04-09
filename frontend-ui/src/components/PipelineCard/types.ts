import type { SvgIconComponent } from '@mui/icons-material';
import type { ReactNode } from 'react';

export type PipelineCardState = 'done' | 'active' | 'pending';

export interface PipelineCardProps {
  state: PipelineCardState;
  icon: SvgIconComponent;
  title: string;
  /** Badge label — typically a count string like "94" */
  badge?: string;
  /** Start expanded (defaults to true when state is 'active') */
  defaultExpanded?: boolean;
  children?: ReactNode;
}
