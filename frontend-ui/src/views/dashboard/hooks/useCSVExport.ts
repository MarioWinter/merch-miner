import { useCallback } from 'react';
import { apiClient } from '../../../services/authService';
import type { DateRange } from '../types';

type ExportType = 'designs' | 'listings' | 'agent' | 'search';

const EXPORT_URLS: Record<ExportType, string> = {
  designs: '/api/dashboard/analytics/designs/export/',
  listings: '/api/dashboard/analytics/listings/export/',
  agent: '/api/dashboard/analytics/agent/export/',
  search: '/api/dashboard/analytics/search/export/',
};

const useCSVExport = (dateRange?: DateRange) => {
  const exportCSV = useCallback(
    async (type: ExportType) => {
      const response = await apiClient.get(EXPORT_URLS[type], {
        params: dateRange || undefined,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}-analytics.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
    [dateRange],
  );

  return { exportCSV };
};

export default useCSVExport;
