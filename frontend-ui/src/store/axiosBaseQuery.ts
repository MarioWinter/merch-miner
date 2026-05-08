import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import type { AxiosRequestConfig, AxiosError, AxiosResponseHeaders } from 'axios';

// Lazy import to break circular dependency:
//   authService → store/index → nicheSlice → axiosBaseQuery → authService
// Calling apiClient inside the inner async function (instead of importing
// at module-top) lets all modules finish initialization before apiClient
// is actually invoked.
const getApiClient = async () => {
  const { apiClient } = await import('../services/authService');
  return apiClient;
};

interface AxiosBaseQueryArgs {
  url: string;
  method?: AxiosRequestConfig['method'];
  data?: unknown;
  params?: unknown;
  /** Axios response type — 'blob' for binary downloads (Phase U, FlyingUpload
   *  export). When set to 'blob' the base query resolves with
   *  `{ blob, filename }` parsed from Content-Disposition. */
  responseType?: AxiosRequestConfig['responseType'];
}

interface AxiosBaseQueryConfig {
  baseUrl?: string;
}

export interface BlobResult {
  blob: Blob;
  filename: string;
}

const FALLBACK_FILENAME = 'download';

/** Pull the filename out of a Content-Disposition header. Handles both
 *  legacy `filename="foo.zip"` and RFC 5987 `filename*=UTF-8''foo.zip`. */
const parseFilename = (headers: AxiosResponseHeaders | Record<string, string> | undefined): string => {
  if (!headers) return FALLBACK_FILENAME;
  const raw =
    (headers as Record<string, string>)['content-disposition'] ??
    (headers as Record<string, string>)['Content-Disposition'];
  if (!raw) return FALLBACK_FILENAME;
  const star = /filename\*=(?:UTF-8''|)([^;]+)/i.exec(raw);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return star[1];
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(raw);
  return plain?.[1] ?? FALLBACK_FILENAME;
};

export const axiosBaseQuery =
  ({ baseUrl = '' }: AxiosBaseQueryConfig = {}): BaseQueryFn<
    AxiosBaseQueryArgs,
    unknown,
    unknown
  > =>
  async ({ url, method = 'GET', data, params, responseType }) => {
    try {
      const isFormData = data instanceof FormData;
      const apiClient = await getApiClient();
      const result = await apiClient({
        url: baseUrl + url,
        method,
        data,
        params,
        ...(responseType ? { responseType } : {}),
        ...(isFormData && { headers: { 'Content-Type': 'multipart/form-data' } }),
      });
      if (responseType === 'blob') {
        const blobResult: BlobResult = {
          blob: result.data as Blob,
          filename: parseFilename(
            result.headers as AxiosResponseHeaders | Record<string, string> | undefined,
          ),
        };
        return { data: blobResult };
      }
      return { data: result.data };
    } catch (axiosError) {
      const err = axiosError as AxiosError;
      return {
        error: {
          status: err.response?.status,
          data: err.response?.data ?? err.message,
        },
      };
    }
  };
