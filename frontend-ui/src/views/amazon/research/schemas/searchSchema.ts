import { z } from 'zod';

export const searchSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required').max(200),
  marketplace: z.string().min(1, 'Marketplace is required'),
});

export type SearchFormValues = z.infer<typeof searchSchema>;
