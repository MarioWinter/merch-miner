/**
 * PROJ-31 — Feature key catalogue (frontend mirror of backend
 * `django-app/core/entitlements.py`).
 *
 * Single source-of-truth for tier-to-feature mapping lives on the backend;
 * the frontend only needs the string keys for typing + IDE autocomplete.
 *
 * Convention: `dotted.namespace.action`. New keys MUST be added BOTH here
 * AND on the backend STAFF_ONLY_FEATURES / TIER_FEATURES list.
 */
export const FEATURE_KEYS = {
  // Free tier (everyone)
  NICHE_RESEARCH: 'niche.research',
  AMAZON_BASIC_SEARCH: 'amazon.basic-search',
  DESIGN_GALLERY: 'design.gallery',
  SLOGAN_BASIC: 'slogan.basic',
  // Staff-only / in-development (will move into paid tiers later)
  AMAZON_MULTI_MARKETPLACE: 'amazon.multi-marketplace',
  KEYWORD_JUNGLESCOUT: 'keyword.junglescout',
  CLOUD_STORAGE: 'cloud.storage',
  DESKTOP_UPLOAD: 'desktop.upload',
  KANBAN: 'kanban',
  EXPERIMENTAL_NEW_EDITOR: 'experimental.new-editor',
  ADMIN_SCRAPER_DEBUG: 'admin.scraper-debug',
  ADMIN_USER_IMPERSONATE: 'admin.user-impersonate',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];
