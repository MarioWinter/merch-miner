import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useTranslation } from 'react-i18next';
import { ModelSelector } from './ModelSelector';
import { BackgroundColorPicker } from './BackgroundColorPicker';
import type { ArtboardData, BackgroundColor, DesignModel } from '../types';
import {
  BarRoot,
  CloseButton,
  CollapsedPlaceholder,
  CollapsedRow,
  ControlsRow,
  ExpandedContent,
  ExpandedHeader,
  GenerateButton,
  Thumbnail,
  ThumbnailArrow,
  ThumbnailRow,
} from './PromptBar.styles';

// -----------------------------------------------------------------
// Analysis steps (reused from old PromptBar)
// -----------------------------------------------------------------

const ANALYSIS_STEPS = [
  'text_dna',
  'visual',
  'spatial',
  'style',
  'color',
  'tech',
  'final_prompt',
] as const;

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface PromptBarProps {
  /** Whether expanded (controlled by parent via usePromptBar) */
  isExpanded: boolean;
  /** Called when user clicks collapsed bar or sparkle */
  onExpand: () => void;
  /** Called when user closes expanded bar */
  onCollapse: () => void;
  /** Current prompt text */
  prompt: string;
  onPromptChange: (prompt: string) => void;
  /** AI model selector */
  model: DesignModel;
  onModelChange: (model: DesignModel) => void;
  /** Background color selector */
  bgColor: BackgroundColor;
  onBgColorChange: (color: BackgroundColor) => void;
  /** Analysis breakdown data (from prompt analysis) */
  promptAnalysis?: Record<string, unknown>;
  /** Generate handler */
  onGenerate: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  /** Source artboard (for thumbnail preview) */
  sourceArtboard?: ArtboardData | null;
  /** Result artboards linked to the AI board */
  resultArtboards?: ArtboardData[];
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const PromptBar = ({
  isExpanded,
  onExpand,
  onCollapse,
  prompt,
  onPromptChange,
  model,
  onModelChange,
  bgColor,
  onBgColorChange,
  promptAnalysis,
  onGenerate,
  isGenerating,
  disabled,
  sourceArtboard,
  resultArtboards = [],
}: PromptBarProps) => {
  const { t } = useTranslation();
  const [builderExpanded, setBuilderExpanded] = useState(false);

  const hasAnalysis =
    promptAnalysis && Object.keys(promptAnalysis).length > 0;

  const hasThumbnails =
    sourceArtboard?.imageUrl || resultArtboards.length > 0;

  // -- Collapsed state --
  if (!isExpanded) {
    return (
      <BarRoot $expanded={false}>
        <CollapsedRow
          onClick={onExpand}
          role="button"
          tabIndex={0}
          aria-label={t('design.prompt.expandBar', 'Open prompt bar')}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onExpand();
            }
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <CollapsedPlaceholder>
            {prompt.trim()
              ? prompt
              : t(
                  'design.prompt.placeholder',
                  'Describe what you want to create...',
                )}
          </CollapsedPlaceholder>
        </CollapsedRow>
      </BarRoot>
    );
  }

  // -- Expanded state --
  return (
    <BarRoot $expanded>
      {/* Header */}
      <ExpandedHeader>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {t('design.prompt.header', 'Edit AI Image Board')}
        </Typography>
        <CloseButton
          onClick={onCollapse}
          aria-label={t('design.prompt.close', 'Close prompt bar')}
          size="small"
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </CloseButton>
      </ExpandedHeader>

      <ExpandedContent>
        {/* Source -> Result thumbnails */}
        {hasThumbnails && (
          <ThumbnailRow>
            {sourceArtboard?.imageUrl && (
              <Thumbnail>
                <img
                  src={sourceArtboard.imageUrl}
                  alt={t('design.prompt.sourceThumbnail', 'Source image')}
                />
              </Thumbnail>
            )}
            {resultArtboards.length > 0 && sourceArtboard?.imageUrl && (
              <ThumbnailArrow>
                <ArrowForwardIcon sx={{ fontSize: 16 }} />
              </ThumbnailArrow>
            )}
            {resultArtboards.map((ab) =>
              ab.imageUrl ? (
                <Thumbnail key={ab.id} $isResult>
                  <img
                    src={ab.imageUrl}
                    alt={t('design.prompt.resultThumbnail', 'Result image')}
                  />
                </Thumbnail>
              ) : null,
            )}
          </ThumbnailRow>
        )}

        {/* Multiline prompt */}
        <TextField
          multiline
          minRows={2}
          maxRows={4}
          fullWidth
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder={t(
            'design.prompt.inputPlaceholder',
            'Describe the design you want to generate...',
          )}
          disabled={disabled || isGenerating}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          aria-label={t('design.prompt.inputLabel', 'Design prompt')}
        />

        {/* Prompt builder accordion */}
        {hasAnalysis && (
          <Accordion
            expanded={builderExpanded}
            onChange={() => setBuilderExpanded(!builderExpanded)}
            disableGutters
            sx={{
              bgcolor: 'transparent',
              boxShadow: 'none',
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ minHeight: 32, px: 0 }}
            >
              <Typography variant="caption" color="text.secondary">
                {t('design.prompt.builder', 'Prompt builder')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0 }}>
              {ANALYSIS_STEPS.map((step) => {
                const stepData = promptAnalysis![step];
                if (!stepData) return null;
                return (
                  <Box key={step} sx={{ mb: 1 }}>
                    <Typography variant="overline" color="text.secondary">
                      {t(`design.board.analysisStep.${step}`)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      {typeof stepData === 'string'
                        ? stepData
                        : JSON.stringify(stepData, null, 2)}
                    </Typography>
                  </Box>
                );
              })}
            </AccordionDetails>
          </Accordion>
        )}

        {/* Controls: Model / BG / Generate */}
        <ControlsRow>
          <Box sx={{ minWidth: 140 }}>
            <ModelSelector
              value={model}
              onChange={onModelChange}
              disabled={disabled || isGenerating}
            />
          </Box>
          <BackgroundColorPicker
            value={bgColor}
            onChange={onBgColorChange}
            disabled={disabled || isGenerating}
          />
          <Stack direction="row" sx={{ ml: 'auto' }}>
            <GenerateButton
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={onGenerate}
              disabled={disabled || isGenerating || !prompt.trim()}
              aria-label={
                isGenerating
                  ? t('design.prompt.generating', 'Generating...')
                  : t('design.prompt.generate', 'Generate')
              }
            >
              {isGenerating
                ? t('design.prompt.generating', 'Generating...')
                : t('design.prompt.generate', 'Generate')}
            </GenerateButton>
          </Stack>
        </ControlsRow>
      </ExpandedContent>
    </BarRoot>
  );
};
