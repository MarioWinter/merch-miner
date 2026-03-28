import { z } from 'zod';

export const ideaCreateSchema = z.object({
  slogan_text: z.string().min(1, 'Slogan text is required').max(2000),
  niche: z.string().uuid().nullable().optional(),
});

export type IdeaCreateFormData = z.infer<typeof ideaCreateSchema>;

export const improveSchema = z.object({
  feedback: z.string().max(500).optional().default(''),
});

export type ImproveFormData = z.infer<typeof improveSchema>;
