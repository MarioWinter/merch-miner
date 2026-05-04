import { useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const STYLE_CATEGORIES = [
  'typography',
  'illustration',
  'photography',
  'graphic_design',
  'fine_art',
  'mixed_media',
  'digital_art',
  'vintage',
] as const;

const STYLES_BY_CATEGORY: Record<string, readonly string[]> = {
  typography: ['bold_sans', 'hand_lettering', 'retro_serif', 'script', 'distressed', 'stencil', 'minimal_mono'],
  illustration: ['line_art', 'flat_vector', 'watercolor', 'sketch', 'cartoon', 'comic_book', 'pop_art'],
  photography: ['studio_product', 'lifestyle', 'macro', 'aerial', 'street', 'vintage_film'],
  graphic_design: ['minimalist', 'brutalist', 'gradient_mesh', 'geometric', 'isometric', 'neon_glow'],
  fine_art: ['oil_painting', 'impressionist', 'abstract', 'surrealist', 'art_deco', 'art_nouveau'],
  mixed_media: ['collage', 'photo_illustration', 'texture_overlay', 'grunge'],
  digital_art: ['3d_render', 'pixel_art', 'glitch', 'vaporwave', 'cyberpunk', 'low_poly'],
  vintage: ['retro_70s', 'retro_80s', 'retro_90s', 'americana', 'psychedelic', 'mid_century'],
};

export type StyleCategory = (typeof STYLE_CATEGORIES)[number];

export interface StyleEntry {
  category: StyleCategory;
  style: string;
}

export interface StyleTabState {
  selectedCategory: StyleCategory | '';
  selectedStyle: string;
  addedStyles: StyleEntry[];
}

interface StyleTabProps {
  state: StyleTabState;
  onChange: (patch: Partial<StyleTabState>) => void;
  onAddStyle: () => void;
  onRemoveStyle: (index: number) => void;
}

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const FieldLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.vars.palette.text.secondary,
  marginBottom: theme.spacing(0.5),
}));

const StyledSelect = styled(Select)(({ theme }) => ({
  height: 40,
  backgroundColor: alpha(COLORS.ink, 0.3),
  borderRadius: theme.shape.borderRadius,
  ...theme.applyStyles('light', {
    backgroundColor: alpha(COLORS.ash, 0.5),
  }),
})) as unknown as typeof Select;

const AddButton = styled(Button)(({ theme }) => ({
  color: theme.vars.palette.text.secondary,
  borderColor: theme.vars.palette.divider,
  borderStyle: 'dashed',
  '&:hover': {
    color: COLORS.cyan,
    borderColor: alpha(COLORS.cyan, 0.4),
    backgroundColor: alpha(COLORS.cyan, 0.06),
  },
}));

const StyleChip = styled(Chip)(() => ({
  backgroundColor: alpha(COLORS.cyan, 0.10),
  color: COLORS.cyan,
  '& .MuiChip-deleteIcon': {
    color: alpha(COLORS.cyan, 0.5),
    '&:hover': {
      color: COLORS.cyan,
    },
  },
}));

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const StyleTab = ({ state, onChange, onAddStyle, onRemoveStyle }: StyleTabProps) => {
  const { t } = useTranslation();

  const availableStyles = state.selectedCategory
    ? STYLES_BY_CATEGORY[state.selectedCategory] ?? []
    : [];

  const handleCategoryChange = useCallback(
    (e: SelectChangeEvent<string>) => {
      onChange({
        selectedCategory: e.target.value as StyleCategory,
        selectedStyle: '',
      });
    },
    [onChange],
  );

  const handleStyleChange = useCallback(
    (e: SelectChangeEvent<string>) => {
      onChange({ selectedStyle: e.target.value });
    },
    [onChange],
  );

  const canAdd = state.selectedCategory && state.selectedStyle;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Category + Style selectors */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FieldLabel>
            {t('design.promptBuilder.style.category', 'Style Category')}
          </FieldLabel>
          <FormControl fullWidth size="small">
            <StyledSelect
              displayEmpty
              value={state.selectedCategory}
              onChange={handleCategoryChange}
              renderValue={(val) =>
                val
                  ? t(`design.promptBuilder.style.categories.${val}`, String(val).replace(/_/g, ' '))
                  : (
                      <Typography variant="body2" color="text.disabled">
                        {t('design.promptBuilder.style.selectCategory', 'Select category')}
                      </Typography>
                    )
              }
            >
              {STYLE_CATEGORIES.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {t(`design.promptBuilder.style.categories.${cat}`, cat.replace(/_/g, ' '))}
                </MenuItem>
              ))}
            </StyledSelect>
          </FormControl>
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <FieldLabel>
            {t('design.promptBuilder.style.style', 'Style')}
          </FieldLabel>
          <FormControl fullWidth size="small" disabled={!state.selectedCategory}>
            <StyledSelect
              displayEmpty
              value={state.selectedStyle}
              onChange={handleStyleChange}
              renderValue={(val) =>
                val
                  ? t(`design.promptBuilder.style.styles.${val}`, String(val).replace(/_/g, ' '))
                  : (
                      <Typography variant="body2" color="text.disabled">
                        {t('design.promptBuilder.style.selectStyle', 'Select style')}
                      </Typography>
                    )
              }
            >
              {availableStyles.map((s) => (
                <MenuItem key={s} value={s}>
                  {t(`design.promptBuilder.style.styles.${s}`, s.replace(/_/g, ' '))}
                </MenuItem>
              ))}
            </StyledSelect>
          </FormControl>
        </Grid>
      </Grid>

      {/* Add Style button */}
      <AddButton
        variant="outlined"
        size="small"
        startIcon={<AddIcon sx={{ fontSize: 18 }} />}
        onClick={onAddStyle}
        disabled={!canAdd}
      >
        {t('design.promptBuilder.style.addStyle', '+ Add Style')}
      </AddButton>

      {/* Added styles chips */}
      {state.addedStyles.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {state.addedStyles.map((entry, idx) => (
            <StyleChip
              key={`${entry.category}-${entry.style}-${idx}`}
              label={t(
                `design.promptBuilder.style.styles.${entry.style}`,
                entry.style.replace(/_/g, ' '),
              )}
              onDelete={() => onRemoveStyle(idx)}
              size="small"
            />
          ))}
        </Box>
      )}

      {/* Empty state */}
      {state.addedStyles.length === 0 && (
        <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 2 }}>
          {t('design.promptBuilder.style.empty', 'No styles added yet. Select a category and style above.')}
        </Typography>
      )}
    </Box>
  );
};

export default StyleTab;
