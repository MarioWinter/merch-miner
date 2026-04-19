import { useCallback } from 'react';
import { Box, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import { Controller, type Control, type FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { MbaListingFormValues } from '../../schemas/mbaListingSchema';
import SectionHeader from './SectionHeader';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const FieldWrapper = styled(Box)({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  '&:hover .ai-improve, &:focus-within .ai-improve': {
    opacity: 1,
  },
});

const InputWrapper = styled(Box)({
  position: 'relative',
});

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.vars.palette.background.paper,
    borderRadius: 8,
    ...theme.typography.body2,
  },
  '& .MuiOutlinedInput-input': {
    ...theme.typography.body2,
  },
}));

type CounterSeverity = 'normal' | 'amber' | 'red';

const CharCounter = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'severity',
})<{ severity: CounterSeverity }>(({ theme, severity }) => ({
  alignSelf: 'flex-end',
  marginTop: theme.spacing(0.5),
  color:
    severity === 'red'
      ? theme.vars.palette.error.main
      : severity === 'amber'
        ? COLORS.warningDk
        : theme.vars.palette.text.disabled,
  transition: `color ${DURATION.fast}ms ${EASING.standard}`,
}));

const AiImproveButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(0.5),
  right: theme.spacing(0.5),
  padding: theme.spacing(0.25),
  color: COLORS.cyan,
  opacity: 0,
  transition: `opacity ${DURATION.fast}ms ${EASING.standard}`,
  '&:focus-visible': {
    opacity: 1,
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getSeverity = (length: number, max: number): CounterSeverity => {
  if (length >= max) return 'red';
  if (length >= Math.floor(max * 0.9)) return 'amber';
  return 'normal';
};

// Narrow to just the string-valued fields of the listing form.
type StringFieldName = Extract<
  FieldPath<MbaListingFormValues>,
  | 'brand'
  | 'title'
  | 'bullet_1'
  | 'bullet_2'
  | 'bullet_3'
  | 'bullet_4'
  | 'bullet_5'
  | 'description'
>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ListingFieldProps {
  name: StringFieldName;
  control: Control<MbaListingFormValues>;
  maxChars: number;
  label: string;
  multiline?: boolean;
  rows?: number;
  context: string;
  onOptionsClick?: (context: string) => void;
  infoTooltip?: string;
  onAiImprove?: (value: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ListingField = ({
  name,
  control,
  maxChars,
  label,
  multiline = false,
  rows,
  context,
  onOptionsClick,
  infoTooltip,
  onAiImprove,
}: ListingFieldProps) => {
  const { t } = useTranslation();

  const handleOptionsClick = useCallback(
    (ctx: string) => {
      onOptionsClick?.(ctx);
    },
    [onOptionsClick],
  );

  const improveLabel = t('publish.edit.fields.aiImprove', {
    defaultValue: 'AI Improve',
  });

  return (
    <FieldWrapper>
      <SectionHeader
        title={label}
        infoTooltip={infoTooltip}
        context={context}
        onOptionsClick={onOptionsClick ? handleOptionsClick : undefined}
      />

      <Controller
        name={name}
        control={control}
        render={({ field, fieldState: { error } }) => {
          const value = field.value ?? '';
          const length = value.length;
          const severity = getSeverity(length, maxChars);
          const isOver = severity === 'red';

          return (
            <>
              <InputWrapper>
                <StyledTextField
                  {...field}
                  value={value}
                  fullWidth
                  variant="outlined"
                  size="small"
                  multiline={multiline}
                  rows={multiline ? (rows ?? 3) : undefined}
                  error={Boolean(error) || isOver}
                  helperText={error?.message}
                  inputProps={{ 'aria-label': label }}
                />
                {onAiImprove && (
                  <Tooltip title={improveLabel} arrow placement="top">
                    <AiImproveButton
                      className="ai-improve"
                      size="small"
                      onClick={() => onAiImprove(value)}
                      aria-label={improveLabel}
                    >
                      <AutoFixHighOutlinedIcon sx={{ fontSize: 16 }} />
                    </AiImproveButton>
                  </Tooltip>
                )}
              </InputWrapper>
              <CharCounter variant="caption" severity={severity}>
                {length}/{maxChars}
              </CharCounter>
            </>
          );
        }}
      />
    </FieldWrapper>
  );
};

export default ListingField;
