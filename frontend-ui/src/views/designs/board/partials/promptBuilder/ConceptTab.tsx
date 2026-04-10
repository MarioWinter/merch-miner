import {
  Box,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import type { ProjectIdea } from '../../../gallery/types';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const CONTENT_TYPES = [
  'typography_only',
  'illustration',
  'photo_realistic',
  'abstract',
  'mixed_media',
  'icon_based',
  'vintage_retro',
  'cartoon',
] as const;

const MOODS = [
  'funny',
  'sarcastic',
  'inspirational',
  'dark_humor',
  'wholesome',
  'edgy',
  'nostalgic',
  'minimalist',
  'bold',
  'playful',
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];
export type Mood = (typeof MOODS)[number];

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface ConceptTabState {
  promptTitle: string;
  selectedSloganId: string | null;
  mainSubject: string;
  contentType: ContentType | '';
  mood: Mood | '';
}

interface ConceptTabProps {
  state: ConceptTabState;
  ideas: ProjectIdea[];
  onChange: (patch: Partial<ConceptTabState>) => void;
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
})) as typeof Select;

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ConceptTab = ({ state, ideas, onChange }: ConceptTabProps) => {
  const { t } = useTranslation();

  const handleSloganChange = (e: SelectChangeEvent<string>) => {
    const sloganId = e.target.value || null;
    onChange({ selectedSloganId: sloganId });

    // Auto-fill Main Subject from selected slogan
    if (sloganId) {
      const idea = ideas.find((i) => i.id === sloganId);
      if (idea && !state.mainSubject) {
        onChange({ mainSubject: idea.slogan_text });
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Prompt Title */}
      <Box>
        <FieldLabel>
          {t('design.promptBuilder.promptTitle', 'Prompt Title')}
        </FieldLabel>
        <TextField
          fullWidth
          size="small"
          placeholder={t('design.promptBuilder.promptTitlePlaceholder', 'Give this prompt a name...')}
          value={state.promptTitle}
          onChange={(e) => onChange({ promptTitle: e.target.value })}
          slotProps={{
            input: {
              sx: { height: 40 },
            },
          }}
        />
      </Box>

      {/* Slogan Selector */}
      <Box>
        <FieldLabel>
          {t('design.promptBuilder.sloganSelector', 'Slogan from Pool')}
        </FieldLabel>
        <FormControl fullWidth size="small">
          <InputLabel>{t('design.promptBuilder.selectSlogan', 'Select slogan')}</InputLabel>
          <StyledSelect
            label={t('design.promptBuilder.selectSlogan', 'Select slogan')}
            value={state.selectedSloganId ?? ''}
            onChange={handleSloganChange}
          >
            <MenuItem value="">
              <Typography variant="body2" color="text.disabled">
                {t('common.none', 'None')}
              </Typography>
            </MenuItem>
            {ideas.map((idea) => (
              <MenuItem key={idea.id} value={idea.id}>
                <Typography variant="body2" noWrap>
                  {idea.slogan_text}
                </Typography>
              </MenuItem>
            ))}
          </StyledSelect>
        </FormControl>
      </Box>

      {/* Main Subject */}
      <Box>
        <FieldLabel>
          {t('design.promptBuilder.mainSubject', 'Main Subject')}
        </FieldLabel>
        <TextField
          fullWidth
          size="small"
          multiline
          rows={3}
          placeholder={t(
            'design.promptBuilder.mainSubjectPlaceholder',
            'Describe the main subject of your design...',
          )}
          value={state.mainSubject}
          onChange={(e) => onChange({ mainSubject: e.target.value })}
        />
      </Box>

      {/* Content Type + Mood — 2 column grid */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FieldLabel>
            {t('design.promptBuilder.contentType', 'Content Type')}
          </FieldLabel>
          <FormControl fullWidth size="small">
            <StyledSelect
              displayEmpty
              value={state.contentType}
              onChange={(e) => onChange({ contentType: e.target.value as ContentType })}
              renderValue={(val) =>
                val
                  ? t(`design.promptBuilder.contentTypes.${val}`, String(val).replace(/_/g, ' '))
                  : (
                      <Typography variant="body2" color="text.disabled">
                        {t('design.promptBuilder.selectContentType', 'Select type')}
                      </Typography>
                    )
              }
            >
              {CONTENT_TYPES.map((ct) => (
                <MenuItem key={ct} value={ct}>
                  {t(`design.promptBuilder.contentTypes.${ct}`, ct.replace(/_/g, ' '))}
                </MenuItem>
              ))}
            </StyledSelect>
          </FormControl>
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <FieldLabel>
            {t('design.promptBuilder.mood', 'Mood')}
          </FieldLabel>
          <FormControl fullWidth size="small">
            <StyledSelect
              displayEmpty
              value={state.mood}
              onChange={(e) => onChange({ mood: e.target.value as Mood })}
              renderValue={(val) =>
                val
                  ? t(`design.promptBuilder.moods.${val}`, String(val).replace(/_/g, ' '))
                  : (
                      <Typography variant="body2" color="text.disabled">
                        {t('design.promptBuilder.selectMood', 'Select mood')}
                      </Typography>
                    )
              }
            >
              {MOODS.map((m) => (
                <MenuItem key={m} value={m}>
                  {t(`design.promptBuilder.moods.${m}`, m.replace(/_/g, ' '))}
                </MenuItem>
              ))}
            </StyledSelect>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ConceptTab;
