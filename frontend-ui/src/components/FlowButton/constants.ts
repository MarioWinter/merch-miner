import KeyOutlined from '@mui/icons-material/KeyOutlined';
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined';
import BrushOutlined from '@mui/icons-material/BrushOutlined';
import ArticleOutlined from '@mui/icons-material/ArticleOutlined';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import { COLORS } from '../../style/constants';

// ── Flow target types ──────────────────────────────────────────────
export type FlowTarget =
  | 'keywords'
  | 'slogans'
  | 'canvas'
  | 'listings'
  | 'upload'
  | 'detail';

export interface FlowTargetConfig {
  icon: SvgIconComponent;
  color: string;
}

// ── Target → icon + color mapping ──────────────────────────────────
export const FLOW_TARGETS: Record<FlowTarget, FlowTargetConfig> = {
  keywords: { icon: KeyOutlined, color: COLORS.warningDk },
  slogans:  { icon: LightbulbOutlined, color: COLORS.cyan },
  canvas:   { icon: BrushOutlined, color: COLORS.red },
  listings: { icon: ArticleOutlined, color: COLORS.successDk },
  upload:   { icon: CloudUploadOutlined, color: COLORS.infoDk },
  detail:   { icon: OpenInNewOutlined, color: COLORS.snowMuted },
} as const;
