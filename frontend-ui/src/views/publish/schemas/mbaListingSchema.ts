import { z } from 'zod';

// ---------------------------------------------------------------------------
// MBA Listing char limits (source of truth for D5 ListingField)
// ---------------------------------------------------------------------------

export const MBA_LISTING_CHAR_LIMITS = {
  brand: 50,
  title: 60,
  bullet_1: 256,
  bullet_2: 256,
  description: 2000,
  keyword_context: 500,
} as const;

export type MbaListingFieldName =
  | 'brand'
  | 'title'
  | 'bullet_1'
  | 'bullet_2'
  | 'description'
  | 'keyword_context';

// ---------------------------------------------------------------------------
// Translation shape (per language)
// ---------------------------------------------------------------------------

const translationEntrySchema = z.object({
  title: z.string().max(MBA_LISTING_CHAR_LIMITS.title),
  description: z.string().max(MBA_LISTING_CHAR_LIMITS.description),
  bullets: z
    .array(z.string().max(MBA_LISTING_CHAR_LIMITS.bullet_1))
    .max(5)
    .default([]),
});

// ---------------------------------------------------------------------------
// Main schema
// ---------------------------------------------------------------------------

export const mbaListingSchema = z.object({
  brand: z.string().max(MBA_LISTING_CHAR_LIMITS.brand).default(''),
  title: z.string().max(MBA_LISTING_CHAR_LIMITS.title).default(''),
  bullet_1: z.string().max(MBA_LISTING_CHAR_LIMITS.bullet_1).default(''),
  bullet_2: z.string().max(MBA_LISTING_CHAR_LIMITS.bullet_2).default(''),
  description: z
    .string()
    .max(MBA_LISTING_CHAR_LIMITS.description)
    .default(''),
  keyword_context: z
    .string()
    .max(MBA_LISTING_CHAR_LIMITS.keyword_context)
    .default(''),
  translations: z.record(z.string(), translationEntrySchema).optional(),
  auto_translate: z.boolean().default(false),
  // D6: Options tab settings (Trademarks tab retired in P9).
  availability: z.enum(['public', 'private']).default('public'),
  publish_mode: z.enum(['live', 'draft']).default('live'),
});

export type MbaListingFormValues = z.infer<typeof mbaListingSchema>;
export type MbaAvailability = MbaListingFormValues['availability'];
export type MbaPublishMode = MbaListingFormValues['publish_mode'];

export const mbaListingDefaultValues: MbaListingFormValues = {
  brand: '',
  title: '',
  bullet_1: '',
  bullet_2: '',
  description: '',
  keyword_context: '',
  translations: {},
  auto_translate: false,
  availability: 'public',
  publish_mode: 'live',
};

// ---------------------------------------------------------------------------
// Supported languages for Translation Tabs (D5-3)
// ---------------------------------------------------------------------------

export type MbaListingLanguage = 'en' | 'de' | 'fr' | 'it' | 'es' | 'ja';

export interface MbaLanguageOption {
  code: MbaListingLanguage;
  label: string;
  flag: string;
}

export const MBA_LANGUAGES: MbaLanguageOption[] = [
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'de', label: 'DE', flag: '🇩🇪' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'it', label: 'IT', flag: '🇮🇹' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'ja', label: 'JA', flag: '🇯🇵' },
];
