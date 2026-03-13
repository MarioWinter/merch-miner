import { z } from 'zod';

export const createNicheSchema = z.object({
  name: z
    .string()
    .min(1, 'niches.validation.nameRequired')
    .max(200, 'niches.validation.nameTooLong'),
  notes: z.string().max(5000, 'niches.validation.notesTooLong').optional(),
});

export const updateNicheSchema = z.object({
  name: z
    .string()
    .min(1, 'niches.validation.nameRequired')
    .max(200, 'niches.validation.nameTooLong')
    .optional(),
  notes: z.string().max(5000, 'niches.validation.notesTooLong').optional(),
  status: z
    .enum([
      'data_entry',
      'deep_research',
      'niche_with_potential',
      'to_designer',
      'upload',
      'start_ads',
      'pending',
      'winner',
      'loser',
      'archived',
    ])
    .optional(),
  potential_rating: z
    .enum(['good', 'very_good', 'rejected'])
    .nullable()
    .optional(),
  assigned_to: z.number().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export type CreateNicheFormValues = z.infer<typeof createNicheSchema>;
export type UpdateNicheFormValues = z.infer<typeof updateNicheSchema>;
