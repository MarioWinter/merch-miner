import { useCallback } from 'react';
import {
  Box,
  Button,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import BiotechIcon from '@mui/icons-material/Biotech';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const PRESET_COLORS = [
  '#FF5A4F', '#00C8D7', '#22D3A3', '#F59E0B',
  '#818CF8', '#FB7185', '#34D399', '#60A5FA',
  '#FF7A72', '#FBBF24', '#A78BFA', '#F472B6',
  '#FFFFFF', '#000000', '#6B7280', '#1F2937',
] as const;

export interface ColorTabState {
  selectedColors: string[];
}

interface ColorTabProps {
  state: ColorTabState;
  researchColors?: string[];
  onChange: (patch: Partial<ColorTabState>) => void;
}

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const FieldLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.vars.palette.text.secondary,
  marginBottom: theme.spacing(0.5),
}));

const SwatchGrid = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
}));

const ColorSwatch = styled('button')<{ color: string; selected: number }>(
  ({ theme, color, selected }) => ({
    all: 'unset',
    cursor: 'pointer',
    width: 40,
    height: 40,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: color,
    border: selected
      ? `2px solid ${COLORS.cyan}`
      : `1px solid ${theme.vars.palette.divider}`,
    boxShadow: selected ? `0 0 12px ${alpha(COLORS.cyan, 0.35)}` : 'none',
    transform: selected ? 'scale(1.1)' : 'scale(1)',
    transition: `transform ${DURATION.fast}ms ${EASING.standard}, box-shadow ${DURATION.fast}ms ${EASING.standard}, border ${DURATION.fast}ms ${EASING.standard}`,
    '&:hover': {
      transform: 'scale(1.1)',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.vars.palette.primary.main}`,
      outlineOffset: 2,
    },
    // Checkerboard for white/light colors
    ...(color === '#FFFFFF' && {
      backgroundImage:
        'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
      backgroundSize: '10px 10px',
      backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
    }),
  }),
);

const RemoveBadge = styled('span')(({ theme }) => ({
  position: 'absolute',
  top: -6,
  right: -6,
  width: 16,
  height: 16,
  borderRadius: '50%',
  backgroundColor: theme.vars.palette.error.main,
  color: theme.vars.palette.common.white,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: 10,
}));

const SwatchWrapper = styled(Box)(() => ({
  position: 'relative',
  display: 'inline-flex',
}));

const AddColorButton = styled(Button)(({ theme }) => ({
  color: theme.vars.palette.text.secondary,
  borderColor: theme.vars.palette.divider,
  borderStyle: 'dashed',
  '&:hover': {
    color: COLORS.cyan,
    borderColor: alpha(COLORS.cyan, 0.4),
    backgroundColor: alpha(COLORS.cyan, 0.06),
  },
}));

const ResearchButton = styled(Button)(() => ({
  color: COLORS.cyan,
  borderColor: alpha(COLORS.cyan, 0.3),
  borderStyle: 'dashed',
  '&:hover': {
    borderColor: alpha(COLORS.cyan, 0.5),
    backgroundColor: alpha(COLORS.cyan, 0.06),
  },
}));

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ColorTab = ({ state, researchColors = [], onChange }: ColorTabProps) => {
  const { t } = useTranslation();

  const toggleColor = useCallback(
    (color: string) => {
      const isSelected = state.selectedColors.includes(color);
      const next = isSelected
        ? state.selectedColors.filter((c) => c !== color)
        : [...state.selectedColors, color];
      onChange({ selectedColors: next });
    },
    [state.selectedColors, onChange],
  );

  const removeColor = useCallback(
    (color: string) => {
      onChange({ selectedColors: state.selectedColors.filter((c) => c !== color) });
    },
    [state.selectedColors, onChange],
  );

  const addFromResearch = useCallback(() => {
    const merged = [...new Set([...state.selectedColors, ...researchColors])];
    onChange({ selectedColors: merged });
  }, [state.selectedColors, researchColors, onChange]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Preset palette */}
      <Box>
        <FieldLabel>
          {t('design.promptBuilder.color.palette', 'Color Palette')}
        </FieldLabel>
        <SwatchGrid>
          {PRESET_COLORS.map((color) => (
            <Tooltip key={color} title={color} placement="top" arrow>
              <ColorSwatch
                color={color}
                selected={state.selectedColors.includes(color) ? 1 : 0}
                onClick={() => toggleColor(color)}
                aria-label={t('design.promptBuilder.color.selectColor', 'Select color {{color}}', { color })}
                aria-pressed={state.selectedColors.includes(color)}
              />
            </Tooltip>
          ))}
        </SwatchGrid>
      </Box>

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <AddColorButton
          variant="outlined"
          size="small"
          startIcon={<AddIcon sx={{ fontSize: 18 }} />}
          onClick={() => {
            // For now, add a random color from presets not yet selected
            const available = PRESET_COLORS.filter((c) => !state.selectedColors.includes(c));
            if (available.length > 0) toggleColor(available[0]);
          }}
        >
          {t('design.promptBuilder.color.addColor', '+ Add Color')}
        </AddColorButton>

        {researchColors.length > 0 && (
          <ResearchButton
            variant="outlined"
            size="small"
            startIcon={<BiotechIcon sx={{ fontSize: 18 }} />}
            onClick={addFromResearch}
          >
            {t('design.promptBuilder.color.fromResearch', 'From Research')}
          </ResearchButton>
        )}
      </Box>

      {/* Selected colors display */}
      {state.selectedColors.length > 0 && (
        <Box>
          <FieldLabel>
            {t('design.promptBuilder.color.selected', 'Selected Colors')}
          </FieldLabel>
          <SwatchGrid>
            {state.selectedColors.map((color) => (
              <SwatchWrapper key={color}>
                <ColorSwatch color={color} selected={1} onClick={() => toggleColor(color)} aria-label={color} />
                <RemoveBadge onClick={() => removeColor(color)} role="button" aria-label={t('common.remove', 'Remove')}>
                  <CloseIcon sx={{ fontSize: 10 }} />
                </RemoveBadge>
              </SwatchWrapper>
            ))}
          </SwatchGrid>
        </Box>
      )}

      {/* Empty state */}
      {state.selectedColors.length === 0 && (
        <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 2 }}>
          {t('design.promptBuilder.color.empty', 'No colors selected. Click swatches above to add colors to your prompt.')}
        </Typography>
      )}
    </Box>
  );
};

export default ColorTab;
