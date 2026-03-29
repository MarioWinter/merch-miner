import { useCallback } from 'react';
import {
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import BarChartIcon from '@mui/icons-material/BarChart';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import { useSnackbar } from 'notistack';
import { apiClient } from '../../../../services/authService';
import type { AmazonProduct } from '../types';

export type ResultsTab = 'products' | 'keywords';

interface ResultsToolbarProps {
  count: number;
  keyword: string;
  isLive: boolean;
  layout: 'grid' | 'list';
  onLayoutChange: (layout: 'grid' | 'list') => void;
  products: AmazonProduct[];
  buildQueryParams: () => Record<string, unknown>;
  activeTab: ResultsTab;
  onTabChange: (tab: ResultsTab) => void;
}

const ResultsToolbar = ({
  count,
  keyword,
  isLive,
  layout,
  onLayoutChange,
  products,
  buildQueryParams,
  activeTab,
  onTabChange,
}: ResultsToolbarProps) => {
  const { enqueueSnackbar } = useSnackbar();

  const handleCopyAsins = useCallback(async () => {
    const asins = products.map((p) => p.asin).join(', ');
    try {
      await navigator.clipboard.writeText(asins);
      enqueueSnackbar('ASINs copied to clipboard', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to copy ASINs', { variant: 'error' });
    }
  }, [products, enqueueSnackbar]);

  const handleExportCSV = useCallback(async () => {
    try {
      const params = buildQueryParams();
      const response = await apiClient.get('/api/research/products/export/', {
        params,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'research-export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      enqueueSnackbar('CSV exported', { variant: 'success' });
    } catch {
      enqueueSnackbar('Export failed', { variant: 'error' });
    }
  }, [buildQueryParams, enqueueSnackbar]);

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      sx={{ mt: 2, mb: 2 }}
    >
      {/* Products / Keywords toggle */}
      <ToggleButtonGroup
        value={activeTab}
        exclusive
        onChange={(_, val) => val && onTabChange(val)}
        size="small"
        aria-label="Results view toggle"
      >
        <ToggleButton value="products" aria-label="Products view">
          <ViewModuleIcon sx={{ fontSize: 18, mr: 0.5 }} />
          Products
        </ToggleButton>
        <ToggleButton value="keywords" aria-label="Keywords view">
          <BarChartIcon sx={{ fontSize: 18, mr: 0.5 }} />
          Keywords
        </ToggleButton>
      </ToggleButtonGroup>

      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
        {count > 0
          ? `${count.toLocaleString()} results${keyword ? ` for "${keyword}"` : ''}`
          : 'No results'}
      </Typography>

      {activeTab === 'products' && (
        <ToggleButtonGroup
          value={layout}
          exclusive
          onChange={(_, val) => val && onLayoutChange(val)}
          size="small"
          aria-label="Layout toggle"
        >
          <ToggleButton value="grid" aria-label="Grid view">
            <GridViewIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
          <ToggleButton value="list" aria-label="List view">
            <ViewListIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
        </ToggleButtonGroup>
      )}

      {!isLive && activeTab === 'products' && (
        <>
          <Button
            variant="outlined"
            color="secondary"
            size="small"
            startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
            onClick={handleCopyAsins}
            disabled={products.length === 0}
            aria-label={`Copy ${products.length} ASINs`}
          >
            Copy {products.length} ASINs
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadIcon sx={{ fontSize: 16 }} />}
            onClick={handleExportCSV}
            disabled={count === 0}
            aria-label="Export CSV"
          >
            Export CSV
          </Button>
        </>
      )}
    </Stack>
  );
};

export default ResultsToolbar;
