import { useCallback } from 'react';
import {
  Box,
  FormControl,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const TEXT_MODES = ['none', 'slogan', 'custom'] as const;

export type TextMode = (typeof TEXT_MODES)[number];

export interface TextTabState {
  textMode: TextMode | '';
  customText: string;
}

interface TextTabProps {
  state: TextTabState;
  sloganText?: string;
  onChange: (patch: Partial<TextTabState>) => void;
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

const PreviewBox = styled(Box)(({ theme }) => ({
  backgroundColor: alpha(COLORS.ink, 0.4),
  backdropFilter: 'blur(8px)',
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(2.5),
  minHeight: 60,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  ...theme.applyStyles('light', {
    backgroundColor: alpha(COLORS.ash, 0.6),
  }),
}));

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const TextTab = ({ state, sloganText, onChange }: TextTabProps) => {
  const { t } = useTranslation();

  const handleModeChange = useCallback(
    (e: SelectChangeEvent<string>) => {
      onChange({ textMode: e.target.value as TextMode });
    },
    [onChange],
  );

  const handleCustomTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ customText: e.target.value });
    },
    [onChange],
  );

  const previewText =
    state.textMode === 'slogan'
      ? sloganText ?? t('design.promptBuilder.text.noSlogan', 'No slogan selected')
      : state.textMode === 'custom'
        ? state.customText || t('design.promptBuilder.text.enterCustom', 'Enter custom text below')
        : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Text Included? selector */}
      <Box>
        <FieldLabel>
          {t('design.promptBuilder.text.textIncluded', 'Text Included?')}
        </FieldLabel>
        <FormControl fullWidth size="small">
          <StyledSelect
            displayEmpty
            value={state.textMode}
            onChange={handleModeChange}
            renderValue={(val) =>
              val
                ? t(`design.promptBuilder.text.modes.${val}`, String(val).replace(/_/g, ' '))
                : (
                    <Typography variant="body2" color="text.disabled">
                      {t('design.promptBuilder.text.selectMode', 'Select text option')}
                    </Typography>
                  )
            }
          >
            {TEXT_MODES.map((mode) => (
              <MenuItem key={mode} value={mode}>
                {t(`design.promptBuilder.text.modes.${mode}`, mode === 'none' ? 'No Text' : mode === 'slogan' ? 'Slogan Text' : 'Custom Text')}
              </MenuItem>
            ))}
          </StyledSelect>
        </FormControl>
      </Box>

      {/* Custom text input (only when custom mode) */}
      {state.textMode === 'custom' && (
        <Box>
          <FieldLabel>
            {t('design.promptBuilder.text.customLabel', 'Custom Text')}
          </FieldLabel>
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            maxRows={4}
            value={state.customText}
            onChange={handleCustomTextChange}
            placeholder={t('design.promptBuilder.text.customPlaceholder', 'Type the text to include in the design...')}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: alpha(COLORS.ink, 0.3),
                borderRadius: 1,
              },
            }}
          />
        </Box>
      )}

      {/* Text preview */}
      {previewText && (
        <Box>
          <FieldLabel>
            {t('design.promptBuilder.text.preview', 'Text Preview')}
          </FieldLabel>
          <PreviewBox>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {previewText}
            </Typography>
          </PreviewBox>
        </Box>
      )}

      {/* Empty/none state */}
      {(!state.textMode || state.textMode === 'none') && (
        <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 2 }}>
          {t('design.promptBuilder.text.noTextHint', 'Design will be generated without text overlay.')}
        </Typography>
      )}
    </Box>
  );
};

export default TextTab;
