/**
 * Pipeline Step Icons — centralized barrel export.
 *
 * Decision log (H2 audit):
 *   ResearchIcon  — MUI ScienceOutlined (flask). Fits "deep research" context. No custom needed.
 *   KeywordsIcon  — MUI VpnKeyOutlined (matches sidebar navConfig). No custom needed.
 *   ProductsIcon  — MUI FavoriteOutlined (collected/heart). No custom needed.
 *   SlogansIcon   — MUI LightbulbOutlined. No custom needed.
 *   DesignsIcon   — MUI BrushOutlined. No custom needed.
 *   ListingsIcon  — MUI ArticleOutlined. No custom needed.
 *   UploadIcon    — MUI CloudUploadOutlined. No custom needed.
 *
 * Base pattern for future custom icons:
 *   - Arrow function component accepting SvgIconProps
 *   - 24px viewBox, currentColor fill/stroke
 *   - 1.5px stroke, strokeLinecap="round", strokeLinejoin="round"
 *
 * Usage:
 *   import { ResearchIcon, SlogansIcon, PIPELINE_ICONS } from '@/assets/icons';
 */

import type { SvgIconComponent } from '@mui/icons-material';
import ScienceOutlined from '@mui/icons-material/ScienceOutlined';
import VpnKeyOutlined from '@mui/icons-material/VpnKeyOutlined';
import FavoriteOutlined from '@mui/icons-material/FavoriteOutlined';
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined';
import BrushOutlined from '@mui/icons-material/BrushOutlined';
import ArticleOutlined from '@mui/icons-material/ArticleOutlined';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';

// --- Pipeline step types ---

export type PipelineStep =
  | 'research'
  | 'keywords'
  | 'products'
  | 'slogans'
  | 'designs'
  | 'listings'
  | 'upload';

// --- Pipeline step icons — semantic aliases ---

export const ResearchIcon = ScienceOutlined;
export const KeywordsIcon = VpnKeyOutlined;
export const ProductsIcon = FavoriteOutlined;
export const SlogansIcon = LightbulbOutlined;
export const DesignsIcon = BrushOutlined;
export const ListingsIcon = ArticleOutlined;
export const UploadIcon = CloudUploadOutlined;

/**
 * Pipeline icon component map — dynamic lookup for PipelineCard, FlowButton, etc.
 *
 * Usage:
 *   const Icon = PIPELINE_ICONS[step];
 *   <Icon sx={{ fontSize: 18 }} />
 */
export const PIPELINE_ICONS: Record<PipelineStep, SvgIconComponent> = {
  research: ScienceOutlined,
  keywords: VpnKeyOutlined,
  products: FavoriteOutlined,
  slogans: LightbulbOutlined,
  designs: BrushOutlined,
  listings: ArticleOutlined,
  upload: CloudUploadOutlined,
};

// --- Re-export existing product type icons for convenience ---

export {
  TShirtIcon,
  PremiumShirtIcon,
  ComfortColorsIcon,
  VNeckIcon,
  LongSleeveIcon,
  RaglanIcon,
  SweatshirtIcon,
} from '@/views/amazon/research/partials/ProductTypeIcons';
