import { useCallback, useMemo } from 'react';
import { Box, Chip, IconButton } from '@mui/material';
import { DataGrid, type GridColDef, type GridSortModel } from '@mui/x-data-grid';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StarIcon from '@mui/icons-material/Star';
import { styled } from '@mui/material/styles';
import { MONO_FONT_STACK } from '../../../../style/constants';
import { MARKETPLACE_OPTIONS, type AmazonProduct } from '../types';

interface ProductTableProps {
  products: AmazonProduct[];
  count: number;
  onSortChange: (sortBy: string) => void;
  loading: boolean;
  /** Called when the user scrolls to the last visible row — enables infinite scroll. */
  onEndReached?: () => void;
}

const ThumbnailImg = styled('img')({
  width: 40,
  height: 50,
  objectFit: 'cover',
  borderRadius: 4,
});

const getBsrColor = (bsr: number | null): 'success' | 'warning' | 'default' => {
  if (bsr === null) return 'default';
  if (bsr < 10000) return 'success';
  if (bsr <= 50000) return 'warning';
  return 'default';
};

const getAmazonUrl = (marketplace: string, asin: string): string => {
  const mp = MARKETPLACE_OPTIONS.find((m) => m.value === marketplace);
  return `https://www.${mp?.domain ?? 'amazon.com'}/dp/${asin}`;
};

const SORT_MAP: Record<string, string> = {
  bsr: 'bsr_asc',
  rating: 'rating_desc',
  reviews_count: 'reviews_desc',
  price: 'price_asc',
  listed_date: 'newest',
};

const ProductTable = ({
  products,
  count,
  onSortChange,
  loading,
  onEndReached,
}: ProductTableProps) => {
  const handleRowClick = useCallback(
    (params: { row: AmazonProduct }) => {
      window.open(`/amazon/research/product/${params.row.asin}`, '_blank', 'noopener');
    },
    [],
  );

  const handleSortModelChange = useCallback(
    (model: GridSortModel) => {
      if (model.length > 0) {
        const field = model[0].field;
        const mapped = SORT_MAP[field];
        if (mapped) onSortChange(mapped);
      }
    },
    [onSortChange],
  );

  const columns: GridColDef<AmazonProduct>[] = useMemo(
    () => [
      {
        field: 'thumbnail_url',
        headerName: '',
        width: 60,
        sortable: false,
        renderCell: (params) => (
          <ThumbnailImg
            src={params.value || '/placeholder-product.png'}
            alt=""
          />
        ),
      },
      { field: 'title', headerName: 'Title', flex: 1, minWidth: 200, sortable: false },
      { field: 'brand', headerName: 'Brand', width: 120, sortable: false },
      {
        field: 'bsr',
        headerName: 'BSR',
        width: 110,
        renderCell: (params) =>
          params.value != null ? (
            <Chip
              label={params.value.toLocaleString()}
              size="small"
              color={getBsrColor(params.value)}
            />
          ) : (
            '-'
          ),
      },
      {
        field: 'rating',
        headerName: 'Rating',
        width: 80,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />
              {Number(params.value).toFixed(1)}
            </Box>
          ) : (
            '-'
          ),
      },
      {
        field: 'reviews_count',
        headerName: 'Reviews',
        width: 90,
        renderCell: (params) =>
          params.value != null ? params.value.toLocaleString() : '-',
      },
      {
        field: 'price',
        headerName: 'Price',
        width: 80,
        renderCell: (params) =>
          params.value != null ? `$${Number(params.value).toFixed(2)}` : '-',
      },
      { field: 'product_type', headerName: 'Type', width: 100, sortable: false },
      {
        field: 'listed_date',
        headerName: 'Listed',
        width: 100,
        renderCell: (params) =>
          params.value
            ? new Date(params.value).toLocaleDateString()
            : '-',
      },
      {
        field: 'asin',
        headerName: 'ASIN',
        width: 120,
        sortable: false,
        renderCell: (params) => (
          <Box sx={{ fontFamily: MONO_FONT_STACK, fontSize: '0.75rem' }}>
            {params.value}
          </Box>
        ),
      },
      {
        field: 'actions',
        headerName: '',
        width: 50,
        sortable: false,
        renderCell: (params) => (
          <IconButton
            size="small"
            component="a"
            href={getAmazonUrl(params.row.marketplace, params.row.asin)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            aria-label="Open on Amazon"
          >
            <OpenInNewIcon sx={{ fontSize: 16 }} />
          </IconButton>
        ),
      },
    ],
    [],
  );

  return (
    <DataGrid
      rows={products}
      columns={columns}
      getRowId={(row) => row.asin}
      rowCount={count}
      sortingMode="server"
      onSortModelChange={handleSortModelChange}
      onRowClick={handleRowClick}
      // DataGrid v8 dropped `onRowsScrollEnd`. The community/free tier no
      // longer has a built-in infinite-scroll prop; we keep the handler wired
      // via prop-spread for parity, and the upgrade to a virtualScroller-based
      // approach is tracked as separate tech debt.
      {...({ onRowsScrollEnd: onEndReached } as object)}
      loading={loading}
      rowHeight={52}
      density="compact"
      disableColumnFilter
      disableRowSelectionOnClick
      hideFooter
      pagination={undefined}
      sx={{ border: 0, height: '70vh', minHeight: 480 }}
      aria-label="Product research results"
    />
  );
};

export default ProductTable;
