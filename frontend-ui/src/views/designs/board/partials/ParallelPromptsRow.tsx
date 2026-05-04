import { Box, IconButton, Switch, Tooltip, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const Row = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const SwitchLabel = styled(Typography)({
  cursor: 'pointer',
  userSelect: 'none',
});

const AnalyzeButton = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: 'transparent',
  color: theme.vars.palette.text.secondary,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: alpha(COLORS.cyan, 0.1),
    borderColor: alpha(COLORS.cyan, 0.3),
    color: COLORS.cyan,
  },
  ...theme.applyStyles('light', {
    '&:hover': {
      backgroundColor: alpha(COLORS.teal, 0.1),
      borderColor: alpha(COLORS.teal, 0.3),
      color: COLORS.teal,
    },
  }),
}));

const BuilderButton = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.vars.palette.secondary.main,
  color: COLORS.white,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: COLORS.cyanDk,
    boxShadow: `0 0 12px ${alpha(COLORS.cyan, 0.3)}`,
  },
  ...theme.applyStyles('light', {
    '&:hover': {
      backgroundColor: COLORS.tealDk,
      boxShadow: `0 0 12px ${alpha(COLORS.teal, 0.3)}`,
    },
  }),
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ParallelPromptsRowProps {
  /** Whether parallel prompts mode is active */
  isParallel: boolean;
  /** Toggle parallel prompts mode */
  onToggle: (checked: boolean) => void;
  /** Open Prompt Builder dialog */
  onOpenBuilder?: () => void;
  /** Trigger image analysis */
  onAnalyzeImage?: () => void;
  /** Whether image analysis is running */
  isAnalyzing?: boolean;
  /** Whether there is a selected image to analyze */
  hasSelectedImage?: boolean;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ParallelPromptsRow = ({
  isParallel,
  onToggle,
  onOpenBuilder,
  onAnalyzeImage,
  isAnalyzing = false,
  hasSelectedImage = false,
  disabled = false,
}: ParallelPromptsRowProps) => {
  const { t } = useTranslation();

  return (
    <Box>
      <Row>
        <Switch
          size="small"
          checked={isParallel}
          onChange={(_, checked) => onToggle(checked)}
          disabled={disabled}
          color="secondary"
          aria-label={t(
            'design.generation.parallelSwitch',
            'Parallel prompts',
          )}
        />
        <SwitchLabel
          variant="subtitle2"
          color="text.primary"
          onClick={() => !disabled && onToggle(!isParallel)}
        >
          {t('design.generation.parallelLabel', 'Parallel Prompts')}
        </SwitchLabel>

        <Box sx={{ ml: 'auto', display: 'flex', gap: 0.75 }}>
          {onAnalyzeImage && (
            <Tooltip
              title={
                hasSelectedImage
                  ? t(
                      'design.generation.analyzeTooltip',
                      'Generate prompt based on your image',
                    )
                  : t(
                      'design.generation.analyzeUpload',
                      'Upload an image to analyze',
                    )
              }
            >
              <span>
                <AnalyzeButton
                  onClick={onAnalyzeImage}
                  disabled={disabled || isAnalyzing}
                  aria-label={t(
                    'design.generation.analyzeImage',
                    'Analyze image',
                  )}
                >
                  <ImageSearchIcon sx={{ fontSize: 18 }} />
                </AnalyzeButton>
              </span>
            </Tooltip>
          )}
          {onOpenBuilder && (
            <Tooltip
              title={t(
                'design.generation.builderTooltip',
                'Open Prompt Builder',
              )}
            >
              <span>
                <BuilderButton
                  onClick={onOpenBuilder}
                  disabled={disabled}
                  aria-label={t(
                    'design.generation.openBuilder',
                    'Open Prompt Builder',
                  )}
                >
                  <AddIcon sx={{ fontSize: 18 }} />
                </BuilderButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </Row>

      {isParallel && (
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ mt: 0.5, display: 'block' }}
        >
          {t(
            'design.generation.parallelHint',
            'Each new line = separate image',
          )}
        </Typography>
      )}
    </Box>
  );
};

export default ParallelPromptsRow;
