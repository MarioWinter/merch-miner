import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';
import { ModelSelector } from './ModelSelector';
import { BackgroundColorPicker } from './BackgroundColorPicker';
import type { BackgroundColor, DesignModel } from '../types';

interface PromptBarProps {
  sloganText: string;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  model: DesignModel;
  onModelChange: (model: DesignModel) => void;
  bgColor: BackgroundColor;
  onBgColorChange: (color: BackgroundColor) => void;
  promptAnalysis?: Record<string, unknown>;
  onGenerate: () => void;
  isGenerating: boolean;
  disabled?: boolean;
}

const ANALYSIS_STEPS = [
  'text_dna',
  'visual',
  'spatial',
  'style',
  'color',
  'tech',
  'final_prompt',
] as const;

const BarRoot = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 56,
  left: 16,
  right: 16,
  zIndex: 10,
  background: `rgba(11,39,49, 0.92)`,
  backdropFilter: 'blur(16px)',
  border: `1px solid rgba(255,255,255,0.10)`,
  borderRadius: 16,
  padding: theme.spacing(2),
  ...theme.applyStyles('light', {
    background: 'rgba(255,255,255,0.92)',
    border: `1px solid rgba(7,30,38,0.10)`,
  }),
}));

const GenerateButton = styled(Button)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.vars.palette.primary.main} 0%, ${theme.vars.palette.primary.dark} 100%)`,
  color: theme.vars.palette.common.white,
  fontWeight: 600,
  minWidth: 140,
  height: 40,
  borderRadius: 8,
  '&:hover': {
    background: `linear-gradient(135deg, ${theme.vars.palette.primary.dark} 0%, ${theme.vars.palette.primary.main} 100%)`,
  },
  '&.Mui-disabled': {
    opacity: 0.5,
  },
}));

export const PromptBar = ({
  sloganText,
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
}: PromptBarProps) => {
  const { t } = useTranslation();
  const [analysisExpanded, setAnalysisExpanded] = useState(false);

  const hasAnalysis =
    promptAnalysis && Object.keys(promptAnalysis).length > 0;

  return (
    <BarRoot>
      {/* Slogan header */}
      {sloganText && (
        <Typography
          variant="body2"
          sx={{
            fontStyle: 'italic',
            color: 'text.secondary',
            mb: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          &ldquo;{sloganText}&rdquo;
        </Typography>
      )}

      {/* Prompt field */}
      <TextField
        multiline
        minRows={2}
        maxRows={6}
        fullWidth
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder={t('design.board.promptPlaceholder')}
        disabled={disabled || isGenerating}
        size="small"
        slotProps={{
          inputLabel: { shrink: true },
        }}
        aria-label={t('design.board.prompt')}
        sx={{ mb: 1.5 }}
      />

      {/* Prompt Builder accordion */}
      {hasAnalysis && (
        <Accordion
          expanded={analysisExpanded}
          onChange={() => setAnalysisExpanded(!analysisExpanded)}
          disableGutters
          sx={{
            mb: 1.5,
            bgcolor: 'transparent',
            boxShadow: 'none',
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 32, px: 0 }}>
            <Typography variant="caption" color="text.secondary">
              {t('design.board.analysisBreakdown')}
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

      {/* Controls row */}
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        <Box sx={{ minWidth: 160 }}>
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
        <Box sx={{ flex: 1 }} />
        <GenerateButton
          variant="contained"
          startIcon={<AutoAwesomeIcon />}
          onClick={onGenerate}
          disabled={disabled || isGenerating || !prompt.trim()}
        >
          {isGenerating
            ? t('design.board.generating')
            : t('design.board.generate')}
        </GenerateButton>
      </Stack>
    </BarRoot>
  );
};
