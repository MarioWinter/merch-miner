import { z } from 'zod';

export const FEEDBACK_TITLE_MAX = 200;
export const FEEDBACK_DESCRIPTION_MAX = 4000;
export const FEEDBACK_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const FEEDBACK_SCREENSHOT_ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const feedbackReportSchema = z.object({
  type: z.enum(['bug', 'feature'], {
    message: 'feedback.form.errors.typeRequired',
  }),
  title: z
    .string()
    .trim()
    .min(1, 'feedback.form.errors.titleRequired')
    .max(FEEDBACK_TITLE_MAX, 'feedback.form.errors.titleTooLong'),
  description: z
    .string()
    .trim()
    .min(1, 'feedback.form.errors.descriptionRequired')
    .max(FEEDBACK_DESCRIPTION_MAX, 'feedback.form.errors.descriptionTooLong'),
});

export type FeedbackReportFormValues = z.infer<typeof feedbackReportSchema>;
