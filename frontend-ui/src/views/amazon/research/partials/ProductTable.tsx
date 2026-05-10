import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Chip, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  DataGrid,
  useGridApiContext,
  type GridColDef,
  type GridSortModel,
} from '@mui/x-data-grid';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StarIcon from '@mui/icons-material/Star';
import ThumbnailHoverPreview from '../../../../components/ThumbnailHoverPreview';
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

/**
 * Custom footer slot that hosts an IntersectionObserver-powered sentinel for
 * infinite scroll. The sentinel is appended into the virtual scroller's
 * content node so the IO can use the virtualScroller as its root and fire
 * `onEndReached` whenever the user scrolls the last row into view.
 *
 * DataGrid v8 dropped the `onRowsScrollEnd` prop, so this is the supported
 * replacement pattern (see `apiRef.current.virtualScrollerRef`).
 */
const InfiniteScrollFooter = ({ onEndReached }: { onEndReached?: () => void }) => {
  const apiRef = useGridApiContext();
  const lastFiredRef = useRef(0);

  useEffect(() => {
    if (!onEndReached) return;
    // Resolve via rootElementRef + querySelector — virtualScrollerRef exists at
    // runtime but is not on the Community GridApi type.
    const root = apiRef.current?.rootElementRef?.current;
    const scroller = root?.querySelector<HTMLElement>('.MuiDataGrid-virtualScroller');
    const content = scroller?.querySelector<HTMLElement>(
      '.MuiDataGrid-virtualScrollerContent',
    );
    if (!scroller || !content) return;

    const sentinel = document.createElement('div');
    sentinel.setAttribute('data-testid', 'product-table-sentinel');
    sentinel.style.height = '1px';
    sentinel.style.width = '100%';
    content.appendChild(sentinel);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        // Throttle so we don't fire onEndReached repeatedly while the
        // sentinel sits in the viewport between data updates.
        const now = Date.now();
        if (now - lastFiredRef.current < 500) return;
        lastFiredRef.current = now;
        onEndReached();
      },
      { root: scroller, rootMargin: '200px 0px 200px 0px', threshold: 0 },
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      sentinel.remove();
    };
  }, [apiRef, onEndReached]);

  return <Box sx={{ height: 0 }} aria-hidden />;
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
        resizable: true,
        renderCell: (params) => (
          <ThumbnailHoverPreview src={params.value || ''}>
            <ThumbnailImg src={params.value || '/placeholder-product.png'} alt="" />
          </ThumbnailHoverPreview>
        ),
      },
      {
        field: 'title',
        headerName: 'Title',
        flex: 1,
        minWidth: 200,
        sortable: false,
        resizable: true,
      },
      {
        field: 'brand',
        headerName: 'Brand',
        width: 120,
        sortable: false,
        resizable: true,
      },
      {
        field: 'bsr',
        headerName: 'BSR',
        width: 110,
        resizable: true,
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
        resizable: true,
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
        resizable: true,
        renderCell: (params) =>
          params.value != null ? params.value.toLocaleString() : '-',
      },
      {
        field: 'price',
        headerName: 'Price',
        width: 80,
        resizable: true,
        renderCell: (params) =>
          params.value != null ? `$${Number(params.value).toFixed(2)}` : '-',
      },
      {
        field: 'product_type',
        headerName: 'Type',
        width: 100,
        sortable: false,
        resizable: true,
      },
      {
        field: 'listed_date',
        headerName: 'Listed',
        width: 100,
        resizable: true,
        renderCell: (params) =>
          params.value ? new Date(params.value).toLocaleDateString() : '-',
      },
      {
        field: 'asin',
        headerName: 'ASIN',
        width: 120,
        sortable: false,
        resizable: true,
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
        resizable: false,
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

  // Memoize the footer slot so the IO effect doesn't tear down on every parent
  // re-render. We re-bind only when the consumer's onEndReached identity
  // changes (the parent stabilizes it via useCallback).
  const FooterSlot = useCallback(
    () => <InfiniteScrollFooter onEndReached={onEndReached} />,
    [onEndReached],
  );

  return (
    <DataGrid
      rows={products}
      columns={columns}
      getRowId={(row) => row.asin}
      rowCount={count}
      sortingMode="server"
      paginationMode="server"
      onSortModelChange={handleSortModelChange}
      onRowClick={handleRowClick}
      loading={loading}
      rowHeight={52}
      density="compact"
      disableColumnFilter
      disableRowSelectionOnClick
      hideFooterPagination
      slots={{ footer: FooterSlot }}
      sx={{ border: 0, height: '70vh', minHeight: 480 }}
      aria-label="Product research results"
    />
  );
};

export default ProductTable;
