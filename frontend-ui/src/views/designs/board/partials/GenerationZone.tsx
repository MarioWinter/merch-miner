import { useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  ClickAwayListener,
  FormControl,
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
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { BackgroundColor, DesignModel } from '../types';
import ParallelPromptsRow from './ParallelPromptsRow';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

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
  borderRadius: theme.shape.borderRadius * 0.75,
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
  border: '1px solid rgba(255,255,255,0.15)',
  flexShrink: 0,
}));

const SliderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));

const PromptTextarea = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: alpha(COLORS.ink, 0.4),
    borderRadius: theme.shape.borderRadius,
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

const ResolutionLabel = styled(Typography)(({ theme }) => ({
  cursor: 'pointer',
  fontSize: '0.75rem',
  color: theme.vars.palette.text.secondary,
  '&:hover': {
    color: theme.vars.palette.text.primary,
  },
}));

const SplitDropdownBtn = styled(Button)(() => ({
  width: 36,
  minWidth: 36,
  padding: 0,
  borderLeft: `1px solid rgba(255,255,255,0.20) !important`,
}));

const SplitMenuPaper = styled(Paper)(({ theme }) => ({
  backgroundColor: COLORS.inkElevated,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  ...theme.applyStyles('light', {
    backgroundColor: theme.vars.palette.background.paper,
  }),
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface GenerationZoneProps {
  /** Current prompt text */
  prompt: string;
  onPromptChange: (prompt: string) => void;
  /** AI model */
  model: DesignModel;
  onModelChange: (model: DesignModel) => void;
  /** Background color */
  bgColor: BackgroundColor;
  onBgColorChange: (color: BackgroundColor) => void;
  /** Number of images to generate */
  imageCount: number;
  onImageCountChange: (count: number) => void;
  /** Generate handler */
  onGenerate: () => void;
  isGenerating: boolean;
  /** Parallel prompts mode */
  isParallel: boolean;
  onParallelToggle: (checked: boolean) => void;
  /** Prompt Builder dialog */
  onOpenPromptBuilder?: () => void;
  /** Image analysis */
  onAnalyzeImage?: () => void;
  isAnalyzingImage?: boolean;
  hasSelectedImage?: boolean;
  /** Resolution display */
  resolution?: string;
  onResolutionClick?: () => void;
  /** Generate All handler (parallel prompts mode) */
  onGenerateAll?: () => void;
  /** Number of parallel prompt lines (for "Generate All (N)" label) */
  parallelLineCount?: number;
  disabled?: boolean;
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
  resolution = '1024 x 1024',
  onResolutionClick,
  onGenerateAll,
  parallelLineCount = 0,
  disabled = false,
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

  const handleSliderChange = (_: Event, value: number | number[]) => {
    const v = typeof value === 'number' ? value : value[0];
    setSliderValue(v);
  };

  const handleSliderCommit = (_: Event | React.SyntheticEvent, value: number | number[]) => {
    const v = typeof value === 'number' ? value : value[0];
    onImageCountChange(v);
  };

  const placeholderText = isParallel
    ? t(
        'design.generation.parallelPlaceholder',
        'Enter prompts (each line = separate image)...',
      )
    : t(
        'design.generation.singlePlaceholder',
        'Describe your design...',
      );

  const generateLabel = isGenerating
    ? t('design.prompt.generating', 'Generating...')
    : t('design.prompt.generate', 'Generate');

  return (
    <ZoneRoot aria-label={t('design.generation.zoneLabel', 'Generation controls')}>
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
              <MenuItem
                key={opt.value}
                value={opt.value}
                sx={{ fontSize: '0.8125rem' }}
              >
                <ColorDot $color={opt.hex} />
                {t(`design.background.${opt.value}`, opt.value)}
              </MenuItem>
            ))}
          </CompactSelect>
        </FormControl>
      </ControlsGrid>

      {/* Images slider + resolution */}
      <SliderRow>
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          {t('design.generation.images', 'Images')}
        </Typography>
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
          valueLabelDisplay="auto"
          aria-label={t('design.generation.imageCount', 'Number of images')}
          sx={{
            flex: 1,
            '& .MuiSlider-thumb': { width: 12, height: 12 },
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 16, textAlign: 'center' }}>
          {sliderValue}
        </Typography>
        {onResolutionClick && (
          <ResolutionLabel variant="body2" onClick={onResolutionClick}>
            {resolution}
          </ResolutionLabel>
        )}
      </SliderRow>

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
                ? {
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2s infinite linear',
                  }
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
            anchorEl={splitAnchorRef.current}
            placement="bottom-end"
            transition
            disablePortal
            sx={{ zIndex: 10 }}
          >
            {({ TransitionProps }) => (
              <Grow {...TransitionProps}>
                <SplitMenuPaper>
                  <ClickAwayListener onClickAway={() => setSplitMenuOpen(false)}>
                    <MenuList dense>
                      <MenuItem
                        onClick={() => {
                          setSplitMenuOpen(false);
                          onGenerate();
                        }}
                      >
                        {t('design.prompt.generate', 'Generate')}
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          setSplitMenuOpen(false);
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
              ? {
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 2s infinite linear',
                }
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
