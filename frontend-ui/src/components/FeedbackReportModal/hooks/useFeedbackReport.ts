import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';

import {
  useCreateReportMutation,
  useUploadScreenshotMutation,
} from '@/store/feedbackSlice';
import {
  feedbackReportSchema,
  type FeedbackReportFormValues,
} from '../schemas/feedbackReportSchema';

interface UseFeedbackReportArgs {
  onSuccess: () => void;
}

/**
 * Combines react-hook-form + RTK Query mutations for the feedback report
 * flow. Returns form bindings, screenshot state, and a single submit handler
 * the dialog calls. Screenshot upload happens BEFORE the report POST so the
 * created report can reference its id.
 */
export const useFeedbackReport = ({ onSuccess }: UseFeedbackReportArgs) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const form = useForm<FeedbackReportFormValues>({
    resolver: zodResolver(feedbackReportSchema),
    mode: 'onChange',
    defaultValues: {
      type: 'bug',
      title: '',
      description: '',
    },
  });

  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);

  const [uploadScreenshot, uploadState] = useUploadScreenshotMutation();
  const [createReport, createState] = useCreateReportMutation();

  const isSubmitting = uploadState.isLoading || createState.isLoading;

  const setScreenshotFile = useCallback((file: File | null) => {
    setScreenshot(file);
    setScreenshotError(null);
  }, []);

  const reset = useCallback(() => {
    form.reset({ type: 'bug', title: '', description: '' });
    setScreenshot(null);
    setScreenshotError(null);
  }, [form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      let screenshotId: string | undefined;
      if (screenshot) {
        const uploaded = await uploadScreenshot(screenshot).unwrap();
        screenshotId = uploaded.id;
      }
      await createReport({
        type: values.type,
        title: values.title.trim(),
        description: values.description.trim(),
        ...(screenshotId ? { screenshot_id: screenshotId } : {}),
      }).unwrap();

      enqueueSnackbar(t('feedback.snackbar.success'), { variant: 'success' });
      reset();
      onSuccess();
    } catch {
      enqueueSnackbar(t('feedback.snackbar.error'), { variant: 'error' });
    }
  });

  // Used by Dialog backdrop/Escape to decide whether to show the discard
  // confirm or close immediately. "Dirty" = the user has touched ANY field,
  // including the screenshot picker.
  const isDirty = form.formState.isDirty || screenshot !== null;

  return {
    form,
    onSubmit,
    isSubmitting,
    isDirty,
    reset,
    screenshot,
    setScreenshotFile,
    screenshotError,
    setScreenshotError,
  };
};
