import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
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
  Tooltip,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING, radius } from '@/style/constants';
import type { BackgroundColor, DesignModel, GenerationMode } from '../types';
import ParallelPromptsRow from './ParallelPromptsRow';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

export type { GenerationMode };

const MODE_OPTIONS: Array<{ value: GenerationMode; labelKey: string }> = [
  { value: 'text_to_image', labelKey: 'design.generation.mode.textToImage' },
  { value: 'remix', labelKey: 'design.generation.mode.remixImage' },
  { value: 'image_to_image_edit', labelKey: 'design.generation.mode.editImage' },
];

export type AspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3' | '5:6';

const ASPECT_RATIO_OPTIONS: Array<{ value: AspectRatio; label: string; width: number; height: number }> = [
  { value: '1:1', label: '1 : 1', width: 1024, height: 1024 },
  { value: '4:3', label: '4 : 3', width: 1365, height: 1024 },
  { value: '3:4', label: '3 : 4', width: 1024, height: 1365 },
  { value: '16:9', label: '16 : 9', width: 1820, height: 1024 },
  { value: '9:16', label: '9 : 16', width: 1024, height: 1820 },
  { value: '3:2', label: '3 : 2', width: 1536, height: 1024 },
  { value: '2:3', label: '2 : 3', width: 1024, height: 1536 },
  // 5:6 portrait — exact ratio (1000/1200 = 5/6) AND multiple-of-8 (diffusion
  // friendly). 4.5× upscale lands on the Merch by Amazon shirt print target
  // EXACTLY (4500×5400 at 300dpi = 15"×18" print).
  { value: '5:6', label: '5 : 6', width: 1000, height: 1200 },
];

const BG_COLOR_OPTIONS: Array<{ value: BackgroundColor; hex: string }> = [
  { value: 'light_gray', hex: '#D3D3D3' },
  { value: 'neon_pink', hex: '#FF6EC7' },
  { value: 'neon_green', hex: '#39FF14' },
];

// Display order: newest version first (proxy for release date when exact
// dates aren't tracked here). Keep MODELS + MODEL_LABELS in sync with the
// equivalent registry in `ModelSelector.tsx`.
const MODEL_LABELS: Record<DesignModel, string> = {
  'openai/gpt-5.4-image-2': 'GPT-5.4 Image 2',
  'google/gemini-3.1-flash-preview-image-generation': 'Nano Banana 2',
  'google/gemini-3-pro-preview-image-generation': 'Nano Banana Pro',
  'openai/gpt-5-image': 'GPT-5 Image',
  'openai/gpt-5-image-mini': 'GPT-5 Mini',
  'google/gemini-2.5-flash-preview-image-generation': 'Nano Banana',
};

const MODELS: DesignModel[] = [
  'openai/gpt-5.4-image-2',
  'google/gemini-3.1-flash-preview-image-generation',
  'google/gemini-3-pro-preview-image-generation',
  'openai/gpt-5-image',
  'openai/gpt-5-image-mini',
  'google/gemini-2.5-flash-preview-image-generation',
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

const ReferenceIndicator = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$empty',
})<{ $empty?: boolean }>(({ theme, $empty }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0.75, 1.25),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: $empty ? alpha(COLORS.cyan, 0.04) : alpha(COLORS.cyan, 0.12),
  border: `1px ${$empty ? 'dashed' : 'solid'} ${alpha(COLORS.cyan, $empty ? 0.2 : 0.3)}`,
  ...theme.applyStyles('light', {
    backgroundColor: $empty ? alpha(COLORS.cyan, 0.03) : alpha(COLORS.cyan, 0.08),
    border: `1px ${$empty ? 'dashed' : 'solid'} ${alpha(COLORS.cyan, $empty ? 0.18 : 0.25)}`,
  }),
}));

const SlotBadge = styled(Box)(({ theme }) => ({
  width: 18,
  height: 18,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.625rem',
  fontWeight: 700,
  color: COLORS.white,
  backgroundColor: COLORS.cyan,
  flexShrink: 0,
  ...theme.applyStyles('light', { color: COLORS.ink }),
}));

interface ReferenceSlotProps {
  imageUrl: string | null | undefined;
  slotIndex: 1 | 2 | null;
  labelFilled: string;
  labelEmpty: string;
  onClear?: () => void;
}

const ReferenceSlot = ({ imageUrl, slotIndex, labelFilled, labelEmpty, onClear }: ReferenceSlotProps) => {
  const { t } = useTranslation();
  const filled = Boolean(imageUrl);
  const clearLabel = slotIndex === 2
    ? t('design.generation.clearReference2', 'Clear reference image 2')
    : t('design.generation.clearReference', 'Clear reference image');
  return (
    <ReferenceIndicator $empty={!filled}>
      {slotIndex !== null && <SlotBadge>{slotIndex}</SlotBadge>}
      {filled ? (
        <Box
          component="img"
          src={imageUrl ?? undefined}
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
      ) : (
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 0.5,
            border: `1px dashed ${alpha(COLORS.cyan, 0.4)}`,
            flexShrink: 0,
          }}
        />
      )}
      <Typography
        variant="caption"
        sx={{
          flex: 1,
          color: filled ? COLORS.cyan : 'text.secondary',
          fontWeight: filled ? 500 : 400,
        }}
        noWrap
      >
        {filled ? labelFilled : labelEmpty}
      </Typography>
      {filled && onClear && (
        <IconButton size="small" onClick={onClear} aria-label={clearLabel} sx={{ p: 0.25 }}>
          <CloseIcon sx={{ fontSize: 14, color: COLORS.cyan }} />
        </IconButton>
      )}
    </ReferenceIndicator>
  );
};

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
  /**
   * FIX Item 4 — `'auto'` when the latest mode change came from the
   * selection-driven reflex; shows an "Auto" chip beside the dropdown so
   * the user knows the panel switched itself (AC-4-11).
   */
  modeSource?: 'auto' | 'manual';
  /** Aspect ratio / resolution */
  aspectRatio?: AspectRatio;
  onAspectRatioChange?: (ratio: AspectRatio) => void;
  onGenerateAll?: () => void;
  parallelLineCount?: number;
  disabled?: boolean;
  /** When set, generation uses this image as source (image-to-image) */
  sourceImageUrl?: string | null;
  onClearSourceImage?: () => void;
  /** Second reference image — required for Remix mode */
  sourceImageUrl2?: string | null;
  onClearSourceImage2?: () => void;
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
  modeSource = 'manual',
  aspectRatio = '1:1',
  onAspectRatioChange,
  onGenerateAll,
  parallelLineCount = 0,
  disabled = false,
  sourceImageUrl = null,
  onClearSourceImage,
  sourceImageUrl2 = null,
  onClearSourceImage2,
}: GenerationZoneProps) => {
  const { t } = useTranslation();
  const [sliderValue, setSliderValue] = useState(imageCount);
  const [splitAnchorEl, setSplitAnchorEl] = useState<HTMLElement | null>(null);
  const splitMenuOpen = Boolean(splitAnchorEl);

  // PERF — local prompt buffer keeps typing fast.
  // The parent's `prompt` state drives many downstream consumers
  // (parallelPrompts split, BuilderDialog dirty check, save/Generate handlers).
  // Letting each keystroke run through `onPromptChange` made the whole
  // DesignWorkspaceView tree re-render synchronously per character,
  // producing 150-180ms long tasks while typing on the canvas. We keep
  // the textarea responsive with a local state and push updates to the
  // parent inside a `startTransition` so React can interrupt the heavy
  // render if more keystrokes are pending.
  // PERF — fully decouple prompt typing from DesignWorkspaceView's render.
  //
  // Previous attempts went through `onPromptChange` on every keystroke
  // (with or without startTransition). The transition only deferred the
  // re-render — it didn't eliminate it — so Konva's rAF loop continued
  // to compete with React commits for the main thread and the textarea
  // still felt sluggish during a typing burst.
  //
  // This version keeps the textarea entirely local. The parent's
  // `prompt` is only updated on blur (when the user is done with the
  // burst) and on programmatic external assignments (slogan insert,
  // Builder build, image-analysis auto-fill, page hydration). The
  // Generate button reads `localPrompt` directly, so the sync timing
  // of `onPromptChange` doesn't matter for that path.
  const [localPrompt, setLocalPrompt] = useState(prompt);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing parent-controlled prompt is intentional
    setLocalPrompt((curr) => (curr === prompt ? curr : prompt));
  }, [prompt]);
  const handlePromptInputChange = (value: string) => {
    setLocalPrompt(value);
  };
  const handlePromptBlur = () => {
    if (localPrompt !== prompt) onPromptChange(localPrompt);
  };

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
    ? t(
        'design.generation.parallelPlaceholder',
        'Enter prompts separated by `;` (each entry = one image)…',
      )
    : t('design.generation.singlePlaceholder', 'Describe your design...');

  const generateLabel = isGenerating
    ? t('design.prompt.generating', 'Generating...')
    : t('design.prompt.generate', 'Generate');

  const remixIncomplete = mode === 'remix' && (!sourceImageUrl || !sourceImageUrl2);
  const editMissingSource = mode === 'image_to_image_edit' && !sourceImageUrl;
  // Use the local buffer for the disable check too — the parent's `prompt`
  // lags one transition behind during a typing burst and would briefly
  // re-disable Generate between local-update and transition-commit.
  const generateDisabled =
    disabled || isGenerating || !localPrompt.trim() || remixIncomplete || editMissingSource;

  return (
    <ZoneRoot aria-label={t('design.generation.zoneLabel', 'Generation controls')}>
      {/* Mode selector — full width. FIX Item 4: when the selection-driven
          reflex set the mode (modeSource === 'auto'), render a small "Auto"
          chip beside the dropdown so the user understands the panel
          switched itself based on the canvas selection (AC-4-11). */}
      {onModeChange && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControl size="small" sx={{ flex: 1 }} disabled={disabled || isGenerating}>
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
          {modeSource === 'auto' && (
            <Tooltip
              title={t(
                'design.imageGen.mode.auto.tooltip',
                'Mode derived from Canvas selection',
              )}
            >
              <Chip
                size="small"
                variant="outlined"
                color="primary"
                label={t('design.imageGen.mode.auto.badge', 'Auto')}
                data-testid="generation-mode-auto-badge"
                sx={{ height: 24, fontSize: '0.6875rem', fontWeight: 600 }}
              />
            </Tooltip>
          )}
        </Box>
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
          {/* AC-38 — Lock the Images slider to 1 when the textarea holds a
             multi-prompt batch (`isParallel` AND ≥2 `;`-split entries),
             since each entry already becomes its own Run. */}
          {(() => {
            const multiPromptActive = isParallel && parallelLineCount >= 2;
            const slider = (
              <Slider
                size="small"
                color="secondary"
                min={IMAGES_MIN}
                max={IMAGES_MAX}
                step={1}
                value={multiPromptActive ? 1 : sliderValue}
                onChange={handleSliderChange}
                onChangeCommitted={handleSliderCommit}
                disabled={disabled || isGenerating || multiPromptActive}
                aria-label={t('design.generation.imageCount', 'Number of images')}
                sx={{ '& .MuiSlider-thumb': { width: 12, height: 12 } }}
              />
            );
            return multiPromptActive ? (
              <Tooltip
                title={t(
                  'design.generation.imagesLockedMultiPrompt',
                  'Locked to 1 while multi-prompt is active',
                )}
                placement="top"
              >
                {/* Wrapper required because MUI Tooltip on disabled Slider
                   needs a non-disabled element to attach pointer events to. */}
                <span style={{ width: '100%', display: 'block' }}>{slider}</span>
              </Tooltip>
            ) : (
              slider
            );
          })()}
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

      {/* Reference image slots — slot 1 always, slot 2 only in Remix mode */}
      {(sourceImageUrl || mode === 'remix') && (
        <ReferenceSlot
          imageUrl={sourceImageUrl}
          slotIndex={mode === 'remix' ? 1 : null}
          labelFilled={t('design.generation.withReference', 'Generating with reference image')}
          labelEmpty={t('design.generation.referenceEmpty1', 'Add reference 1 (click "Use as Reference")')}
          onClear={onClearSourceImage}
        />
      )}
      {mode === 'remix' && (
        <ReferenceSlot
          imageUrl={sourceImageUrl2}
          slotIndex={2}
          labelFilled={t('design.generation.withReference2', 'Reference 2')}
          labelEmpty={t('design.generation.referenceEmpty2', 'Add reference 2 (Remix needs two)')}
          onClear={onClearSourceImage2}
        />
      )}

      {/* Prompt textarea */}
      <PromptTextarea
        multiline
        minRows={isParallel ? 8 : 4}
        maxRows={isParallel ? 8 : 4}
        fullWidth
        value={localPrompt}
        onChange={(e) => handlePromptInputChange(e.target.value)}
        onBlur={handlePromptBlur}
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
            disabled={generateDisabled}
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
            disabled={generateDisabled}
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
          disabled={generateDisabled}
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
