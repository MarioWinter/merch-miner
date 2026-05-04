// ---------------------------------------------------------------------------
// FlyingUpload Export — backend error code → i18n key mapping (Phase W, AC-113)
// ---------------------------------------------------------------------------
// Backend returns `{ error: { code, detail, design_ids? } }` with a stable
// `code` enum. We route each known code to a short, translated snackbar key
// under `publish.export.errors.*`. Unknown codes fall back to a generic
// "Export failed" key so the user still sees a useful message.
// ---------------------------------------------------------------------------

export interface BackendExportError {
  code?: string;
  detail?: string;
  design_ids?: string[];
}

export interface RtkBackendError {
  status?: number;
  data?:
    | {
        error?: BackendExportError;
        detail?: string;
        code?: string;
      }
    | unknown;
}

/** Extract the backend error `code` from the shape axiosBaseQuery returns. */
export const extractErrorCode = (err: unknown): string | null => {
  if (!err || typeof err !== 'object') return null;
  const maybe = err as RtkBackendError;
  const data = maybe.data;
  if (data && typeof data === 'object') {
    const d = data as { error?: BackendExportError; code?: string };
    if (d.error?.code) return d.error.code;
    if (d.code) return d.code;
  }
  return null;
};

const KNOWN_CODES: Record<string, string> = {
  max_500_designs_per_export: 'publish.export.errors.max_500_designs_per_export',
  estimated_archive_too_large: 'publish.export.errors.estimated_archive_too_large',
  no_listing: 'publish.export.errors.no_listing',
  no_global_listing: 'publish.export.errors.no_global_listing',
  no_enabled_products: 'publish.export.errors.no_enabled_products',
  image_unavailable: 'publish.export.errors.image_unavailable',
  catalog_unknown_product: 'publish.export.errors.catalog_unknown_product',
  export_timed_out: 'publish.export.errors.timeout',
};

/** Resolve a backend code → i18n key. Unknown codes fall back to generic. */
export const mapExportError = (code: string | null | undefined): string => {
  if (!code) return 'publish.export.errors.generic';
  return KNOWN_CODES[code] ?? 'publish.export.errors.generic';
};
