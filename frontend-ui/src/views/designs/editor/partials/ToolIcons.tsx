import type { SvgIconComponent } from '@mui/icons-material';
import AspectRatioOutlined from '@mui/icons-material/AspectRatioOutlined';
import CropOutlined from '@mui/icons-material/CropOutlined';
import RotateRightOutlined from '@mui/icons-material/RotateRightOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import TextureOutlined from '@mui/icons-material/TextureOutlined';
import FormatColorFillOutlined from '@mui/icons-material/FormatColorFillOutlined';
import AutoFixHighOutlined from '@mui/icons-material/AutoFixHighOutlined';
import LayersClearOutlined from '@mui/icons-material/LayersClearOutlined';
import BrandingWatermarkOutlined from '@mui/icons-material/BrandingWatermarkOutlined';
import DeblurOutlined from '@mui/icons-material/DeblurOutlined';
import CompressOutlined from '@mui/icons-material/CompressOutlined';
import PaletteOutlined from '@mui/icons-material/PaletteOutlined';
import BlurLinearOutlined from '@mui/icons-material/BlurLinearOutlined';
import WallpaperOutlined from '@mui/icons-material/WallpaperOutlined';
import ZoomOutMapOutlined from '@mui/icons-material/ZoomOutMapOutlined';
import FolderZipOutlined from '@mui/icons-material/FolderZipOutlined';
import type { ToolName } from '../types';

export const TOOL_ICON_MAP: Record<ToolName, SvgIconComponent> = {
  resize: AspectRatioOutlined,
  trim: CropOutlined,
  rotate: RotateRightOutlined,
  filters: TuneOutlined,
  distress: TextureOutlined,
  color_removal: FormatColorFillOutlined,
  speckle_remover: AutoFixHighOutlined,
  transparency_cleaner: LayersClearOutlined,
  watermark: BrandingWatermarkOutlined,
  defringe: DeblurOutlined,
  shrink: CompressOutlined,
  color_defringe: PaletteOutlined,
  edge_cleaner: BlurLinearOutlined,
  bg_remove: WallpaperOutlined,
  ai_upscale: ZoomOutMapOutlined,
  compressor: FolderZipOutlined,
};
