import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import type { AxiosRequestConfig, AxiosError } from 'axios';
import { apiClient } from '../services/authService';

interface AxiosBaseQueryArgs {
  url: string;
  method?: AxiosRequestConfig['method'];
  data?: unknown;
  params?: unknown;
}

interface AxiosBaseQueryConfig {
  baseUrl?: string;
}

export const axiosBaseQuery =
  ({ baseUrl = '' }: AxiosBaseQueryConfig = {}): BaseQueryFn<
    AxiosBaseQueryArgs,
    unknown,
    unknown
  > =>
  async ({ url, method = 'GET', data, params }) => {
    try {
      const isFormData = data instanceof FormData;
      const result = await apiClient({
        url: baseUrl + url,
        method,
        data,
        params,
        ...(isFormData && { headers: { 'Content-Type': 'multipart/form-data' } }),
      });
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
