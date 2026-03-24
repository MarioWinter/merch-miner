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
import { useSnackbar } from 'notistack';
import { apiClient } from '../../../../services/authService';
import type { AmazonProduct, ResearchFilters } from '../types';

interface ResultsToolbarProps {
  count: number;
  keyword: string;
  isLive: boolean;
  layout: 'grid' | 'list';
  onLayoutChange: (layout: 'grid' | 'list') => void;
  products: AmazonProduct[];
  filters: ResearchFilters;
}

const ResultsToolbar = ({
  count,
  keyword,
  isLive,
  layout,
  onLayoutChange,
  products,
  filters,
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
      const params: Record<string, unknown> = { ...filters };
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
  }, [filters, enqueueSnackbar]);

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      sx={{ mt: 2, mb: 2 }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
        {count > 0
          ? `${count.toLocaleString()} results${keyword ? ` for "${keyword}"` : ''}`
          : 'No results'}
      </Typography>

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

      {!isLive && (
        <>
          <Button
            variant="outlined"
            color="secondary"
            size="small"
            startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
            onClick={handleCopyAsins}
            disabled={products.length === 0}
            aria-label="Copy all ASINs"
          >
            Copy ASINs
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
