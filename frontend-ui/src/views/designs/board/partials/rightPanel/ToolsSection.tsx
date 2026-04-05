import { Box, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import PhotoSizeSelectLargeIcon from '@mui/icons-material/PhotoSizeSelectLarge';
import LayersIcon from '@mui/icons-material/Layers';
import CropIcon from '@mui/icons-material/Crop';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const ToolGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
}));

const ToolButton = styled('button')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: theme.spacing(1.5, 0.5),
  border: '1px solid',
  borderColor: theme.vars.palette.divider,
  borderRadius: 8,
  cursor: 'pointer',
  backgroundColor: 'transparent',
  color: theme.vars.palette.text.secondary,
  fontFamily: 'inherit',
  fontSize: '0.6875rem',
  fontWeight: 500,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: alpha(COLORS.red, 0.08),
    color: theme.vars.palette.text.primary,
    borderColor: alpha(COLORS.red, 0.2),
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.vars.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  padding: theme.spacing(0, 2),
  marginTop: theme.spacing(1),
}));

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface ToolsSectionProps {
  showRegenerate?: boolean;
  onRegenerate?: () => void;
  onBgRemove?: () => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ToolsSection = ({ showRegenerate, onRegenerate, onBgRemove }: ToolsSectionProps) => {
  const { t } = useTranslation();

  const tools = [
    ...(showRegenerate
      ? [
          {
            key: 'regenerate',
            icon: <AutoFixHighIcon sx={{ fontSize: 20 }} />,
            label: t('design.panel.tools.regenerate', 'Regenerate'),
            onClick: onRegenerate,
          },
        ]
      : []),
    {
      key: 'aiBoard',
      icon: <AutoFixHighIcon sx={{ fontSize: 20 }} />,
      label: t('design.panel.tools.aiImageBoard', 'AI Board'),
      onClick: undefined,
    },
    {
      key: 'flatten',
      icon: <LayersIcon sx={{ fontSize: 20 }} />,
      label: t('design.panel.tools.flatten', 'Flatten'),
      onClick: undefined,
    },
    {
      key: 'upscale',
      icon: <PhotoSizeSelectLargeIcon sx={{ fontSize: 20 }} />,
      label: t('design.panel.tools.upscale', 'Upscale'),
      onClick: undefined,
    },
    {
      key: 'reframe',
      icon: <CropIcon sx={{ fontSize: 20 }} />,
      label: t('design.panel.tools.reframe', 'Reframe'),
      onClick: undefined,
    },
    {
      key: 'bgRemove',
      icon: <WallpaperIcon sx={{ fontSize: 20 }} />,
      label: t('design.panel.tools.bgRemove', 'BG Remove'),
      onClick: onBgRemove,
    },
  ];

  return (
    <Box>
      <SectionLabel variant="overline" color="text.secondary">
        {t('design.panel.toolsLabel', 'Tools')}
      </SectionLabel>
      <ToolGrid>
        {tools.map((tool) => (
          <ToolButton
            key={tool.key}
            onClick={tool.onClick}
            aria-label={tool.label}
          >
            {tool.icon}
            {tool.label}
          </ToolButton>
        ))}
      </ToolGrid>
    </Box>
  );
};

export default ToolsSection;
