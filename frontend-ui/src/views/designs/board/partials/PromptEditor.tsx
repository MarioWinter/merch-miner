import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';

interface PromptEditorProps {
  value: string;
  onChange: (prompt: string) => void;
  promptAnalysis?: Record<string, unknown>;
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

export const PromptEditor = ({
  value,
  onChange,
  promptAnalysis,
  disabled,
}: PromptEditorProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const hasAnalysis =
    promptAnalysis && Object.keys(promptAnalysis).length > 0;

  return (
    <Box>
      <TextField
        multiline
        minRows={4}
        maxRows={12}
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('design.board.promptPlaceholder')}
        disabled={disabled}
        slotProps={{
          inputLabel: { shrink: true },
        }}
        label={t('design.board.prompt')}
        aria-label={t('design.board.prompt')}
      />

      {hasAnalysis && (
        <Accordion
          expanded={expanded}
          onChange={() => setExpanded(!expanded)}
          sx={{ mt: 1 }}
          disableGutters
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="caption" color="text.secondary">
              {t('design.board.analysisBreakdown')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {ANALYSIS_STEPS.map((step) => {
              const stepData = promptAnalysis[step];
              if (!stepData) return null;
              return (
                <Box key={step} sx={{ mb: 1 }}>
                  <Typography variant="overline" color="text.secondary">
                    {t(`design.board.analysisStep.${step}`)}
                  </Typography>
                  <Typography variant="body2">
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
    </Box>
  );
};
