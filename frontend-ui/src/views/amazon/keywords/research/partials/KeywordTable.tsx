import { useMemo, useCallback } from 'react';
import { Box, Skeleton } from '@mui/material';
import { DataGrid, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import { MONO_FONT_STACK } from '@/style/constants';
import type { KeywordSearchResult, KeywordColumnVisibility } from '../types';
import { SourceBadge } from './SourceBadge';
import { EnrichButton } from './EnrichButton';

interface KeywordTableProps {
  rows: KeywordSearchResult[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  columnVisibility: KeywordColumnVisibility;
  isLoading: boolean;
  selectedKeywords: string[];
  onSelectionChange: (keywords: string[]) => void;
  onEnrichSingle: (keyword: string) => void;
  isEnriching: (keyword: string) => boolean;
  onKeywordClick: (keyword: string) => void;
}

export const KeywordTable = ({
  rows,
  totalCount,
  page,
  pageSize,
  onPageChange,
  columnVisibility,
  isLoading,
  selectedKeywords,
  onSelectionChange,
  onEnrichSingle,
  isEnriching,
  onKeywordClick,
}: KeywordTableProps) => {
  const { t } = useTranslation();

  const columns = useMemo<GridColDef[]>(() => {
    const allCols: GridColDef[] = [
      {
        field: 'keyword',
        headerName: t('keywords.table.col_keyword'),
        flex: 2,
        minWidth: 200,
        renderCell: (params) => (
          <Box
            onClick={() => onKeywordClick(params.value)}
            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          >
            {params.value}
          </Box>
        ),
      },
      {
        field: 'source',
        headerName: t('keywords.table.col_source'),
        width: 120,
        renderCell: (params) => <SourceBadge source={params.value} />,
      },
      {
        field: 'monthly_search_volume_exact',
        headerName: t('keywords.table.col_monthly_search_volume_exact'),
        width: 130,
        type: 'number',
        valueGetter: (_value, row) => row.js_data?.monthly_search_volume_exact ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>{params.value.toLocaleString()}</Box>
          ) : (
            <Box sx={{ color: 'text.disabled' }}>--</Box>
          ),
      },
      {
        field: 'ppc_bid_exact',
        headerName: t('keywords.table.col_ppc_bid_exact'),
        width: 110,
        type: 'number',
        valueGetter: (_value, row) => row.js_data?.ppc_bid_exact ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>${params.value.toFixed(2)}</Box>
          ) : (
            <Box sx={{ color: 'text.disabled' }}>--</Box>
          ),
      },
      {
        field: 'ease_of_ranking_score',
        headerName: t('keywords.table.col_ease_of_ranking_score'),
        width: 110,
        type: 'number',
        valueGetter: (_value, row) => row.js_data?.ease_of_ranking_score ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>{params.value}/10</Box>
          ) : (
            <Box sx={{ color: 'text.disabled' }}>--</Box>
          ),
      },
      {
        field: 'organic_product_count',
        headerName: t('keywords.table.col_organic_product_count'),
        width: 110,
        type: 'number',
        valueGetter: (_value, row) => row.js_data?.organic_product_count ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>{params.value.toLocaleString()}</Box>
          ) : (
            <Box sx={{ color: 'text.disabled' }}>--</Box>
          ),
      },
      {
        field: 'in_product_count',
        headerName: t('keywords.table.col_in_product_count'),
        width: 100,
        type: 'number',
        renderCell: (params) => (
          <Box sx={{ fontFamily: MONO_FONT_STACK }}>{params.value ?? 0}</Box>
        ),
      },
      {
        field: 'in_slogan_count',
        headerName: t('keywords.table.col_in_slogan_count'),
        width: 100,
        type: 'number',
        renderCell: (params) => (
          <Box sx={{ fontFamily: MONO_FONT_STACK }}>{params.value ?? 0}</Box>
        ),
      },
      {
        field: 'monthly_trend',
        headerName: t('keywords.table.col_monthly_trend'),
        width: 110,
        type: 'number',
        valueGetter: (_value, row) => row.js_data?.monthly_trend ?? null,
      },
      {
        field: 'quarterly_trend',
        headerName: t('keywords.table.col_quarterly_trend'),
        width: 110,
        type: 'number',
        valueGetter: (_value, row) => row.js_data?.quarterly_trend ?? null,
      },
      {
        field: 'monthly_search_volume_broad',
        headerName: t('keywords.table.col_monthly_search_volume_broad'),
        width: 130,
        type: 'number',
        valueGetter: (_value, row) => row.js_data?.monthly_search_volume_broad ?? null,
      },
      {
        field: 'ppc_bid_broad',
        headerName: t('keywords.table.col_ppc_bid_broad'),
        width: 110,
        type: 'number',
        valueGetter: (_value, row) => row.js_data?.ppc_bid_broad ?? null,
      },
      {
        field: 'sp_brand_ad_bid',
        headerName: t('keywords.table.col_sp_brand_ad_bid'),
        width: 120,
        type: 'number',
        valueGetter: (_value, row) => row.js_data?.sp_brand_ad_bid ?? null,
      },
      {
        field: 'relevancy_score',
        headerName: t('keywords.table.col_relevancy_score'),
        width: 110,
        type: 'number',
        valueGetter: (_value, row) => row.js_data?.relevancy_score ?? null,
      },
      {
        field: 'sponsored_product_count',
        headerName: t('keywords.table.col_sponsored_product_count'),
        width: 130,
        type: 'number',
        valueGetter: (_value, row) => row.js_data?.sponsored_product_count ?? null,
      },
      {
        field: 'dominant_category',
        headerName: t('keywords.table.col_dominant_category'),
        width: 160,
        valueGetter: (_value, row) => row.js_data?.dominant_category ?? '',
      },
      {
        field: 'recommended_promotions',
        headerName: t('keywords.table.col_recommended_promotions'),
        width: 130,
        type: 'number',
        valueGetter: (_value, row) => row.js_data?.recommended_promotions ?? null,
      },
      {
        field: 'actions',
        headerName: '',
        width: 60,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <EnrichButton
            keyword={params.row.keyword}
            isEnriching={isEnriching(params.row.keyword)}
            onEnrich={() => onEnrichSingle(params.row.keyword)}
          />
        ),
      },
    ];

    return allCols.filter((col) => {
      if (col.field === 'actions') return true;
      const key = col.field as keyof KeywordColumnVisibility;
      return columnVisibility[key] !== false;
    });
  }, [t, columnVisibility, onKeywordClick, onEnrichSingle, isEnriching]);

  const handleSelectionChange = useCallback(
    (model: GridRowSelectionModel) => {
      onSelectionChange(Array.from(model.ids).map(String));
    },
    [onSelectionChange],
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={44} sx={{ borderRadius: 1 }} />
        ))}
      </Box>
    );
  }

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      getRowId={(row) => row.keyword}
      rowCount={totalCount}
      paginationMode="server"
      paginationModel={{ page: page - 1, pageSize }}
      onPaginationModelChange={(model) => onPageChange(model.page + 1)}
      checkboxSelection
      rowSelectionModel={{ type: 'include', ids: new Set(selectedKeywords) }}
      onRowSelectionModelChange={handleSelectionChange}
      disableRowSelectionOnClick
      density="compact"
      autoHeight
      pageSizeOptions={[25]}
      sx={{
        border: 'none',
        '& .MuiDataGrid-columnHeaders': {
          backgroundColor: 'background.paper',
        },
        '& .MuiDataGrid-row:hover': {
          backgroundColor: 'rgba(255,255,255,0.03)',
        },
        '& .MuiDataGrid-cell': {
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        },
      }}
    />
  );
};
