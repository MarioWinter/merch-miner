import { z } from 'zod';
import { COUNTRIES } from '../data/countries';

const VALID_CODES = COUNTRIES.map((c) => c.code);

export const billingSchema = z.object({
  account_type: z.enum(['personal', 'business']),
  company_name: z.string().max(200).optional().or(z.literal('')),
  vat_number: z.string().max(50).optional().or(z.literal('')),
  address_line1: z.string().max(200).optional().or(z.literal('')),
  address_line2: z.string().max(200).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state_region: z.string().max(100).optional().or(z.literal('')),
  postal_code: z.string().max(20).optional().or(z.literal('')),
  country: z
    .string()
    .refine((v) => v === '' || VALID_CODES.includes(v), {
      message: 'Select a valid country',
    })
    .optional()
    .or(z.literal('')),
});

export type BillingFormValues = z.infer<typeof billingSchema>;
