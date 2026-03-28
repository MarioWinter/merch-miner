import { useCallback, useState } from 'react';
import { apiClient } from '@/services/authService';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

export const useKeywordExport = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [isExporting, setIsExporting] = useState(false);

  const exportCSV = useCallback(
    async (query: string, marketplace: string) => {
      setIsExporting(true);
      try {
        const response = await apiClient({
          url: '/api/keywords/export/',
          method: 'GET',
          params: { query, marketplace, format: 'csv' },
          responseType: 'blob',
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `keywords-${query}-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch {
        enqueueSnackbar(t('keywords.errors.exportFailed'), { variant: 'error' });
      } finally {
        setIsExporting(false);
      }
    },
    [enqueueSnackbar, t],
  );

  return { exportCSV, isExporting };
};
