import { useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  ClickAwayListener,
  FormControl,
  IconButton,
  Grow,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Select,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING, radius } from '@/style/constants';
import type { BackgroundColor, DesignModel } from '../types';
import ParallelPromptsRow from './ParallelPromptsRow';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

export type GenerationMode = 'text_to_image' | 'image_to_image_remix' | 'image_to_image_edit';

const MODE_OPTIONS: Array<{ value: GenerationMode; labelKey: string }> = [
  { value: 'text_to_image', labelKey: 'design.generation.mode.textToImage' },
  { value: 'image_to_image_remix', labelKey: 'design.generation.mode.remixImage' },
  { value: 'image_to_image_edit', labelKey: 'design.generation.mode.editImage' },
];

export type AspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3';

const ASPECT_RATIO_OPTIONS: Array<{ value: AspectRatio; label: string; width: number; height: number }> = [
  { value: '1:1', label: '1 : 1', width: 1024, height: 1024 },
  { value: '4:3', label: '4 : 3', width: 1365, height: 1024 },
  { value: '3:4', label: '3 : 4', width: 1024, height: 1365 },
  { value: '16:9', label: '16 : 9', width: 1820, height: 1024 },
  { value: '9:16', label: '9 : 16', width: 1024, height: 1820 },
  { value: '3:2', label: '3 : 2', width: 1536, height: 1024 },
  { value: '2:3', label: '2 : 3', width: 1024, height: 1536 },
];

const BG_COLOR_OPTIONS: Array<{ value: BackgroundColor; hex: string }> = [
  { value: 'light_gray', hex: '#D3D3D3' },
  { value: 'neon_pink', hex: '#FF6EC7' },
  { value: 'neon_green', hex: '#39FF14' },
];

const MODEL_LABELS: Record<DesignModel, string> = {
  'google/gemini-3.1-flash-preview-image-generation': 'Nano Banana 2',
  'google/gemini-3-pro-preview-image-generation': 'Nano Banana Pro',
  'google/gemini-2.5-flash-preview-image-generation': 'Nano Banana',
  'openai/gpt-5-image': 'GPT-5 Image',
  'openai/gpt-5-image-mini': 'GPT-5 Mini',
  'black-forest-labs/flux-1.1-pro': 'Flux 1.1 Pro',
  'bytedance-seed/seedream-4.5': 'Seedream 4.5',
};

const MODELS: DesignModel[] = [
  'google/gemini-3.1-flash-preview-image-generation',
  'google/gemini-3-pro-preview-image-generation',
  'google/gemini-2.5-flash-preview-image-generation',
  'openai/gpt-5-image',
  'openai/gpt-5-image-mini',
  'black-forest-labs/flux-1.1-pro',
  'bytedance-seed/seedream-4.5',
];

const IMAGES_MIN = 1;
const IMAGES_MAX = 8;

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const ZoneRoot = styled(Box)(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: 2,
  backgroundColor: COLORS.inkPaper,
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  ...theme.applyStyles('light', {
    backgroundColor: theme.vars.palette.background.paper,
  }),
}));

const ControlsGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: theme.spacing(1),
}));

const CompactSelect = styled(Select)(({ theme }) => ({
  height: 32,
  fontSize: '0.8125rem',
  backgroundColor: COLORS.inkElevated,
  borderRadius: radius(theme, 0.75),
  '& .MuiSelect-select': {
    paddingTop: 4,
    paddingBottom: 4,
  },
  ...theme.applyStyles('light', {
    backgroundColor: theme.vars.palette.background.default,
  }),
}));

const ColorDot = styled('span')<{ $color: string }>(({ $color }) => ({
  display: 'inline-block',
  width: 10,
  height: 10,
  borderRadius: 2,
  backgroundColor: $color,
  marginRight: 6,
  verticalAlign: 'middle',
  border: `1px solid ${alpha(COLORS.snow, 0.15)}`,
  flexShrink: 0,
}));

const SliderBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  padding: theme.spacing(1, 1.25),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: alpha(COLORS.inkElevated, 0.5),
  ...theme.applyStyles('light', {
    backgroundColor: alpha(COLORS.ash, 0.4),
  }),
}));

const SliderLabel = styled(Typography)({
  fontSize: '0.75rem',
  fontWeight: 600,
  flexShrink: 0,
  whiteSpace: 'nowrap',
});

const PromptTextarea = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: alpha(COLORS.ink, 0.4),
    borderRadius: theme.shape.borderRadius,
    '& textarea': {
      resize: 'vertical',
    },
    '& fieldset': {
      borderColor: theme.vars.palette.divider,
    },
    '&:hover fieldset': {
      borderColor: theme.vars.palette.text.secondary,
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.vars.palette.primary.main,
    },
  },
  ...theme.applyStyles('light', {
    '& .MuiOutlinedInput-root': {
      backgroundColor: alpha(COLORS.ashDefault, 0.6),
    },
  }),
}));

const GenerateBtn = styled(Button)(({ theme }) => ({
  width: '100%',
  height: 40,
  fontWeight: 600,
  fontSize: '0.875rem',
  borderRadius: theme.shape.borderRadius,
  background: `linear-gradient(135deg, ${COLORS.red} 0%, ${COLORS.redDk} 100%)`,
  color: COLORS.white,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    background: `linear-gradient(135deg, ${COLORS.redDk} 0%, ${COLORS.red} 100%)`,
    boxShadow: `0 0 24px ${alpha(COLORS.red, 0.3)}`,
  },
  '&.Mui-disabled': {
    opacity: 0.5,
    background: `linear-gradient(135deg, ${COLORS.red} 0%, ${COLORS.redDk} 100%)`,
    color: COLORS.white,
  },
  '@keyframes shimmer': {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' },
  },
}));

const SplitDropdownBtn = styled(Button)(() => ({
  width: 36,
  minWidth: 36,
  padding: 0,
  borderLeft: `1px solid ${alpha(COLORS.snow, 0.20)} !important`,
}));

const SplitMenuPaper = styled(Paper)(({ theme }) => ({
  backgroundColor: COLORS.inkElevated,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  ...theme.applyStyles('light', {
    backgroundColor: theme.vars.palette.background.paper,
  }),
}));

const ReferenceIndicator = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0.75, 1.25),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(COLORS.cyan, 0.12),
  border: `1px solid ${alpha(COLORS.cyan, 0.3)}`,
  ...theme.applyStyles('light', {
    backgroundColor: alpha(COLORS.cyan, 0.08),
    border: `1px solid ${alpha(COLORS.cyan, 0.25)}`,
  }),
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface GenerationZoneProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  model: DesignModel;
  onModelChange: (model: DesignModel) => void;
  bgColor: BackgroundColor;
  onBgColorChange: (color: BackgroundColor) => void;
  imageCount: number;
  onImageCountChange: (count: number) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  isParallel: boolean;
  onParallelToggle: (checked: boolean) => void;
  onOpenPromptBuilder?: () => void;
  onAnalyzeImage?: () => void;
  isAnalyzingImage?: boolean;
  hasSelectedImage?: boolean;
  /** Generation mode */
  mode?: GenerationMode;
  onModeChange?: (mode: GenerationMode) => void;
  /** Aspect ratio / resolution */
  aspectRatio?: AspectRatio;
  onAspectRatioChange?: (ratio: AspectRatio) => void;
  onGenerateAll?: () => void;
  parallelLineCount?: number;
  disabled?: boolean;
  /** When set, generation uses this image as source (image-to-image) */
  sourceImageUrl?: string | null;
  onClearSourceImage?: () => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const GenerationZone = ({
  prompt,
  onPromptChange,
  model,
  onModelChange,
  bgColor,
  onBgColorChange,
  imageCount,
  onImageCountChange,
  onGenerate,
  isGenerating,
  isParallel,
  onParallelToggle,
  onOpenPromptBuilder,
  onAnalyzeImage,
  isAnalyzingImage = false,
  hasSelectedImage = false,
  mode = 'text_to_image',
  onModeChange,
  aspectRatio = '1:1',
  onAspectRatioChange,
  onGenerateAll,
  parallelLineCount = 0,
  disabled = false,
  sourceImageUrl = null,
  onClearSourceImage,
}: GenerationZoneProps) => {
  const { t } = useTranslation();
  const [sliderValue, setSliderValue] = useState(imageCount);
  const [splitAnchorEl, setSplitAnchorEl] = useState<HTMLElement | null>(null);
  const splitMenuOpen = Boolean(splitAnchorEl);

  const handleModelChange = (e: SelectChangeEvent<unknown>) => {
    onModelChange(e.target.value as DesignModel);
  };

  const handleBgColorChange = (e: SelectChangeEvent<unknown>) => {
    onBgColorChange(e.target.value as BackgroundColor);
  };

  const handleModeChange = (e: SelectChangeEvent<unknown>) => {
    onModeChange?.(e.target.value as GenerationMode);
  };

  const handleAspectRatioChange = (_: Event, value: number | number[]) => {
    const idx = typeof value === 'number' ? value : value[0];
    const opt = ASPECT_RATIO_OPTIONS[idx];
    if (opt) onAspectRatioChange?.(opt.value);
  };

  const handleSliderChange = (_: Event, value: number | number[]) => {
    const v = typeof value === 'number' ? value : value[0];
    setSliderValue(v);
  };

  const handleSliderCommit = (_: Event | React.SyntheticEvent, value: number | number[]) => {
    const v = typeof value === 'number' ? value : value[0];
    onImageCountChange(v);
  };

  const currentAspectIdx = ASPECT_RATIO_OPTIONS.findIndex((o) => o.value === aspectRatio);
  const currentAspect = ASPECT_RATIO_OPTIONS[currentAspectIdx >= 0 ? currentAspectIdx : 0];

  const placeholderText = isParallel
    ? t('design.generation.parallelPlaceholder', 'Enter prompts (each line = separate image)...')
    : t('design.generation.singlePlaceholder', 'Describe your design...');

  const generateLabel = isGenerating
    ? t('design.prompt.generating', 'Generating...')
    : t('design.prompt.generate', 'Generate');

  return (
    <ZoneRoot aria-label={t('design.generation.zoneLabel', 'Generation controls')}>
      {/* Mode selector — full width */}
      {onModeChange && (
        <FormControl size="small" fullWidth disabled={disabled || isGenerating}>
          <CompactSelect
            value={mode}
            onChange={handleModeChange}
            aria-label={t('design.generation.mode.label', 'Mode')}
          >
            {MODE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.8125rem' }}>
                {t(opt.labelKey, opt.value)}
              </MenuItem>
            ))}
          </CompactSelect>
        </FormControl>
      )}

      {/* Model + BG Color selectors */}
      <ControlsGrid>
        <FormControl size="small" fullWidth disabled={disabled || isGenerating}>
          <CompactSelect
            value={model}
            onChange={handleModelChange}
            aria-label={t('design.model.label', 'AI Model')}
            displayEmpty
          >
            {MODELS.map((m) => (
              <MenuItem key={m} value={m} sx={{ fontSize: '0.8125rem' }}>
                {MODEL_LABELS[m]}
              </MenuItem>
            ))}
          </CompactSelect>
        </FormControl>

        <FormControl size="small" fullWidth disabled={disabled || isGenerating}>
          <CompactSelect
            value={bgColor}
            onChange={handleBgColorChange}
            aria-label={t('design.background.label', 'Background color')}
            displayEmpty
            renderValue={(selected) => {
              const opt = BG_COLOR_OPTIONS.find((o) => o.value === selected);
              return (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {opt && <ColorDot $color={opt.hex} />}
                  {t(`design.background.${selected as string}`, selected as string)}
                </Box>
              );
            }}
          >
            {BG_COLOR_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.8125rem' }}>
                <ColorDot $color={opt.hex} />
                {t(`design.background.${opt.value}`, opt.value)}
              </MenuItem>
            ))}
          </CompactSelect>
        </FormControl>
      </ControlsGrid>

      {/* Images slider + Resolution slider — side by side */}
      <ControlsGrid>
        <SliderBox>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SliderLabel color="text.secondary">
              {t('design.generation.images', 'Images')}
            </SliderLabel>
            <Typography variant="caption" fontWeight={600}>
              {sliderValue}
            </Typography>
          </Box>
          <Slider
            size="small"
            color="secondary"
            min={IMAGES_MIN}
            max={IMAGES_MAX}
            step={1}
            value={sliderValue}
            onChange={handleSliderChange}
            onChangeCommitted={handleSliderCommit}
            disabled={disabled || isGenerating}
            aria-label={t('design.generation.imageCount', 'Number of images')}
            sx={{ '& .MuiSlider-thumb': { width: 12, height: 12 } }}
          />
        </SliderBox>

        <SliderBox>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SliderLabel color="text.secondary">
              {t('design.generation.res', 'Res.')}
            </SliderLabel>
            <Typography variant="caption" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
              {currentAspect.label} ({currentAspect.width}&times;{currentAspect.height})
            </Typography>
          </Box>
          <Slider
            size="small"
            color="secondary"
            min={0}
            max={ASPECT_RATIO_OPTIONS.length - 1}
            step={1}
            value={currentAspectIdx >= 0 ? currentAspectIdx : 0}
            onChange={handleAspectRatioChange}
            disabled={disabled || isGenerating || !onAspectRatioChange}
            aria-label={t('design.generation.resolution', 'Resolution')}
            sx={{ '& .MuiSlider-thumb': { width: 12, height: 12 } }}
          />
        </SliderBox>
      </ControlsGrid>

      {/* Parallel Prompts toggle + action buttons */}
      <ParallelPromptsRow
        isParallel={isParallel}
        onToggle={onParallelToggle}
        onOpenBuilder={onOpenPromptBuilder}
        onAnalyzeImage={onAnalyzeImage}
        isAnalyzing={isAnalyzingImage}
        hasSelectedImage={hasSelectedImage}
        disabled={disabled || isGenerating}
      />

      {/* Reference image indicator with thumbnail */}
      {sourceImageUrl && (
        <ReferenceIndicator>
          <Box
            component="img"
            src={sourceImageUrl}
            alt=""
            sx={{
              width: 32,
              height: 32,
              borderRadius: 0.5,
              objectFit: 'cover',
              flexShrink: 0,
              border: `1px solid ${alpha(COLORS.cyan, 0.4)}`,
            }}
          />
          <Typography
            variant="caption"
            sx={{ flex: 1, color: COLORS.cyan, fontWeight: 500 }}
            noWrap
          >
            {t('design.generation.withReference', 'Generating with reference image')}
          </Typography>
          {onClearSourceImage && (
            <IconButton
              size="small"
              onClick={onClearSourceImage}
              aria-label={t('design.generation.clearReference', 'Clear reference image')}
              sx={{ p: 0.25 }}
            >
              <CloseIcon sx={{ fontSize: 14, color: COLORS.cyan }} />
            </IconButton>
          )}
        </ReferenceIndicator>
      )}

      {/* Prompt textarea */}
      <PromptTextarea
        multiline
        minRows={isParallel ? 8 : 4}
        maxRows={isParallel ? 8 : 4}
        fullWidth
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder={placeholderText}
        disabled={disabled || isGenerating}
        size="small"
        slotProps={{ inputLabel: { shrink: true } }}
        aria-label={t('design.prompt.inputLabel', 'Design prompt')}
      />

      {/* Generate button — split variant when parallel mode has lines */}
      {isParallel && parallelLineCount > 1 && onGenerateAll ? (
        <ButtonGroup
          variant="contained"
          fullWidth
          aria-label={t('design.generation.generateGroup', 'Generate actions')}
        >
          <GenerateBtn
            startIcon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />}
            onClick={onGenerate}
            disabled={disabled || isGenerating || !prompt.trim()}
            aria-label={generateLabel}
            sx={
              isGenerating
                ? { backgroundSize: '200% 100%', animation: 'shimmer 2s infinite linear' }
                : undefined
            }
          >
            {generateLabel}
          </GenerateBtn>
          <SplitDropdownBtn
            onClick={(e) => setSplitAnchorEl(splitAnchorEl ? null : e.currentTarget)}
            disabled={disabled || isGenerating || !prompt.trim()}
            aria-label={t('design.generation.moreOptions', 'More generate options')}
            sx={{
              background: `linear-gradient(135deg, ${COLORS.red} 0%, ${COLORS.redDk} 100%)`,
              color: COLORS.white,
              '&:hover': {
                background: `linear-gradient(135deg, ${COLORS.redDk} 0%, ${COLORS.red} 100%)`,
              },
              '&.Mui-disabled': {
                opacity: 0.5,
                background: `linear-gradient(135deg, ${COLORS.red} 0%, ${COLORS.redDk} 100%)`,
                color: COLORS.white,
              },
            }}
          >
            <ArrowDropDownIcon />
          </SplitDropdownBtn>
          <Popper
            open={splitMenuOpen}
            anchorEl={splitAnchorEl}
            placement="bottom-end"
            transition
            disablePortal
            sx={{ zIndex: 10 }}
          >
            {({ TransitionProps }) => (
              <Grow {...TransitionProps}>
                <SplitMenuPaper>
                  <ClickAwayListener onClickAway={() => setSplitAnchorEl(null)}>
                    <MenuList dense>
                      <MenuItem
                        onClick={() => {
                          setSplitAnchorEl(null);
                          onGenerate();
                        }}
                      >
                        {t('design.prompt.generate', 'Generate')}
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          setSplitAnchorEl(null);
                          onGenerateAll();
                        }}
                      >
                        {t('design.generation.generateAll', 'Generate All ({{count}})', {
                          count: parallelLineCount,
                        })}
                      </MenuItem>
                    </MenuList>
                  </ClickAwayListener>
                </SplitMenuPaper>
              </Grow>
            )}
          </Popper>
        </ButtonGroup>
      ) : (
        <GenerateBtn
          variant="contained"
          startIcon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />}
          onClick={onGenerate}
          disabled={disabled || isGenerating || !prompt.trim()}
          aria-label={generateLabel}
          sx={
            isGenerating
              ? { backgroundSize: '200% 100%', animation: 'shimmer 2s infinite linear' }
              : undefined
          }
        >
          {generateLabel}
        </GenerateBtn>
      )}
    </ZoneRoot>
  );
};

export default GenerationZone;
