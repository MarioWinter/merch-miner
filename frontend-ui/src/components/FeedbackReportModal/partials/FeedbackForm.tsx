import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from '@mui/material';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  FEEDBACK_DESCRIPTION_MAX,
  FEEDBACK_TITLE_MAX,
  type FeedbackReportFormValues,
} from '../schemas/feedbackReportSchema';
import ScreenshotUpload from './ScreenshotUpload';

interface FeedbackFormProps {
  form: UseFormReturn<FeedbackReportFormValues>;
  screenshot: File | null;
  screenshotError: string | null;
  disabled?: boolean;
  onScreenshotChange: (file: File | null) => void;
  onScreenshotError: (msg: string | null) => void;
}

const FeedbackForm = ({
  form,
  screenshot,
  screenshotError,
  disabled,
  onScreenshotChange,
  onScreenshotError,
}: FeedbackFormProps) => {
  const { t } = useTranslation();
  const {
    control,
    formState: { errors },
    watch,
  } = form;

  const titleValue = watch('title') ?? '';
  const descriptionValue = watch('description') ?? '';
  const titleRemaining = FEEDBACK_TITLE_MAX - titleValue.length;
  const descriptionRemaining = FEEDBACK_DESCRIPTION_MAX - descriptionValue.length;

  // Map zod i18n keys back to translated strings (zod messages are stored as
  // translation keys for late-binding to the active language).
  const translateError = (key: string | undefined) =>
    key ? t(key) : undefined;

  return (
    <Stack spacing={3}>
      <Controller
        name="type"
        control={control}
        render={({ field }) => (
          <FormControl error={Boolean(errors.type)} disabled={disabled}>
            <FormLabel id="feedback-type-label">
              {t('feedback.form.type.label')}
            </FormLabel>
            <RadioGroup
              row
              aria-labelledby="feedback-type-label"
              value={field.value}
              onChange={field.onChange}
            >
              <FormControlLabel
                value="bug"
                control={<Radio />}
                label={t('feedback.form.type.bug')}
              />
              <FormControlLabel
                value="feature"
                control={<Radio />}
                label={t('feedback.form.type.feature')}
              />
            </RadioGroup>
            {errors.type && (
              <FormHelperText>{translateError(errors.type.message)}</FormHelperText>
            )}
          </FormControl>
        )}
      />

      <Controller
        name="title"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label={t('feedback.form.title.label')}
            placeholder={t('feedback.form.title.placeholder')}
            fullWidth
            required
            disabled={disabled}
            error={Boolean(errors.title)}
            helperText={
              translateError(errors.title?.message) ??
              t('feedback.form.title.charsRemaining', {
                count: Math.max(titleRemaining, 0),
              })
            }
            slotProps={{
              htmlInput: { maxLength: FEEDBACK_TITLE_MAX },
            }}
          />
        )}
      />

      <Controller
        name="description"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label={t('feedback.form.description.label')}
            placeholder={t('feedback.form.description.placeholder')}
            fullWidth
            required
            multiline
            rows={6}
            disabled={disabled}
            error={Boolean(errors.description)}
            helperText={
              translateError(errors.description?.message) ??
              t('feedback.form.description.charsRemaining', {
                count: Math.max(descriptionRemaining, 0),
              })
            }
            slotProps={{
              htmlInput: { maxLength: FEEDBACK_DESCRIPTION_MAX },
            }}
          />
        )}
      />

      <ScreenshotUpload
        file={screenshot}
        error={screenshotError}
        disabled={disabled}
        onFileChange={onScreenshotChange}
        onError={onScreenshotError}
      />
    </Stack>
  );
};

export default FeedbackForm;
