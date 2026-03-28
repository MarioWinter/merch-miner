import { z } from 'zod';
import { LISTING_CHAR_LIMITS } from '../types';

export const listingSchema = z.object({
  brand_name: z
    .string()
    .min(1, 'Brand name is required')
    .max(LISTING_CHAR_LIMITS.brand_name, `Max ${LISTING_CHAR_LIMITS.brand_name} characters`),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(LISTING_CHAR_LIMITS.title, `Max ${LISTING_CHAR_LIMITS.title} characters`),
  bullet_1: z
    .string()
    .max(LISTING_CHAR_LIMITS.bullet_1, `Max ${LISTING_CHAR_LIMITS.bullet_1} characters`),
  bullet_2: z
    .string()
    .max(LISTING_CHAR_LIMITS.bullet_2, `Max ${LISTING_CHAR_LIMITS.bullet_2} characters`),
  bullet_3: z
    .string()
    .max(LISTING_CHAR_LIMITS.bullet_3, `Max ${LISTING_CHAR_LIMITS.bullet_3} characters`),
  bullet_4: z
    .string()
    .max(LISTING_CHAR_LIMITS.bullet_4, `Max ${LISTING_CHAR_LIMITS.bullet_4} characters`),
  bullet_5: z
    .string()
    .max(LISTING_CHAR_LIMITS.bullet_5, `Max ${LISTING_CHAR_LIMITS.bullet_5} characters`),
  description: z
    .string()
    .max(LISTING_CHAR_LIMITS.description, `Max ${LISTING_CHAR_LIMITS.description} characters`),
  backend_keywords: z
    .string()
    .max(
      LISTING_CHAR_LIMITS.backend_keywords,
      `Max ${LISTING_CHAR_LIMITS.backend_keywords} characters`,
    ),
  availability: z.enum(['public', 'private']),
  publish_mode: z.enum(['live', 'draft']),
});

export type ListingFormValues = z.infer<typeof listingSchema>;

export const uploadTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  brand_name: z.string().max(50).default(''),
  product_types: z.array(z.string()).default([]),
  fit_types: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
  marketplaces: z
    .array(
      z.object({
        marketplace: z.string(),
        price: z.string(),
        enabled: z.boolean(),
      }),
    )
    .default([]),
  print_side: z.enum(['front', 'back', 'both']).default('front'),
});

export type UploadTemplateFormValues = z.infer<typeof uploadTemplateSchema>;
