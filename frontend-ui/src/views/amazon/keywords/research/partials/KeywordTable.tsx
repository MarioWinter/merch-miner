import { useMemo, useCallback } from 'react';
import { Box, CircularProgress, IconButton, Skeleton, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { DataGrid, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { MONO_FONT_STACK } from '@/style/constants';
import { useScrapeProductCountMutation } from '@/store/keywordSlice';
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
  onSearchKeyword: (keyword: string) => void;
  marketplace: string;
}

const JsPlaceholder = () => (
  <Box sx={{ color: 'text.disabled', opacity: 0.4, fontFamily: MONO_FONT_STACK }}>
    &mdash;
  </Box>
);

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
  onSearchKeyword,
  marketplace,
}: KeywordTableProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [scrapeCount, { isLoading: isScraping }] = useScrapeProductCountMutation();

  const handleCopyKeyword = useCallback(
    (keyword: string) => {
      navigator.clipboard.writeText(keyword);
      enqueueSnackbar(t('keywords.table.copiedKeyword'), { variant: 'success' });
    },
    [enqueueSnackbar, t],
  );

  const handleRefreshCount = useCallback(
    (keyword: string) => {
      scrapeCount({ keyword, marketplace });
    },
    [scrapeCount, marketplace],
  );

  const columns = useMemo<GridColDef[]>(() => {
    const allCols: GridColDef[] = [
      {
        field: 'keyword',
        headerName: t('keywords.table.col_keyword'),
        flex: 2,
        minWidth: 250,
        cellClassName: 'keyword-cell',
        renderCell: (params) => (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <Box
              onClick={() => onKeywordClick(params.value)}
              sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            >
              {params.value}
            </Box>
            <Box
              className="keyword-hover-actions"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.25, opacity: 0, transition: 'opacity 150ms ease' }}
            >
              <Tooltip title={t('keywords.table.copyKeyword')}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyKeyword(params.row.keyword);
                  }}
                  sx={{ p: 0.25 }}
                >
                  <ContentCopyIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('keywords.table.searchKeyword')}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSearchKeyword(params.row.keyword);
                  }}
                  sx={{ p: 0.25 }}
                >
                  <SearchIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <EnrichButton
                keyword={params.row.keyword}
                isEnriching={isEnriching(params.row.keyword)}
                onEnrich={() => onEnrichSingle(params.row.keyword)}
              />
            </Box>
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
        field: 'amazon_product_count',
        headerName: t('keywords.table.col_amazon_product_count'),
        width: 140,
        type: 'number',
        description: t('keywords.table.refreshProductCount'),
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {params.value != null ? (
              <Box sx={{ fontFamily: MONO_FONT_STACK }}>
                &gt; {params.value.toLocaleString()}
              </Box>
            ) : (
              <Box sx={{ color: 'text.disabled' }}>&mdash;</Box>
            )}
            <Tooltip title={t('keywords.table.refreshProductCount')}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefreshCount(params.row.keyword);
                }}
                disabled={isScraping}
                sx={{ p: 0.25 }}
              >
                {isScraping ? (
                  <CircularProgress size={14} />
                ) : (
                  <RefreshIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
      {
        field: 'monthly_search_volume_exact',
        headerName: t('keywords.table.col_monthly_search_volume_exact'),
        width: 130,
        type: 'number',
        description: t('keywords.suggestionTabs.comingSoon'),
        valueGetter: (_value, row) => row.js_data?.monthly_search_volume_exact ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>{params.value.toLocaleString()}</Box>
          ) : (
            <JsPlaceholder />
          ),
      },
      {
        field: 'ppc_bid_exact',
        headerName: t('keywords.table.col_ppc_bid_exact'),
        width: 110,
        type: 'number',
        description: t('keywords.suggestionTabs.comingSoon'),
        valueGetter: (_value, row) => row.js_data?.ppc_bid_exact ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>${params.value.toFixed(2)}</Box>
          ) : (
            <JsPlaceholder />
          ),
      },
      {
        field: 'ease_of_ranking_score',
        headerName: t('keywords.table.col_ease_of_ranking_score'),
        width: 110,
        type: 'number',
        description: t('keywords.suggestionTabs.comingSoon'),
        valueGetter: (_value, row) => row.js_data?.ease_of_ranking_score ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>{params.value}/10</Box>
          ) : (
            <JsPlaceholder />
          ),
      },
      {
        field: 'organic_product_count',
        headerName: t('keywords.table.col_organic_product_count'),
        width: 110,
        type: 'number',
        description: t('keywords.suggestionTabs.comingSoon'),
        valueGetter: (_value, row) => row.js_data?.organic_product_count ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>{params.value.toLocaleString()}</Box>
          ) : (
            <JsPlaceholder />
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
        description: t('keywords.suggestionTabs.comingSoon'),
        valueGetter: (_value, row) => row.js_data?.monthly_trend ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>{params.value}</Box>
          ) : (
            <JsPlaceholder />
          ),
      },
      {
        field: 'quarterly_trend',
        headerName: t('keywords.table.col_quarterly_trend'),
        width: 110,
        type: 'number',
        description: t('keywords.suggestionTabs.comingSoon'),
        valueGetter: (_value, row) => row.js_data?.quarterly_trend ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>{params.value}</Box>
          ) : (
            <JsPlaceholder />
          ),
      },
      {
        field: 'monthly_search_volume_broad',
        headerName: t('keywords.table.col_monthly_search_volume_broad'),
        width: 130,
        type: 'number',
        description: t('keywords.suggestionTabs.comingSoon'),
        valueGetter: (_value, row) => row.js_data?.monthly_search_volume_broad ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>{params.value.toLocaleString()}</Box>
          ) : (
            <JsPlaceholder />
          ),
      },
      {
        field: 'ppc_bid_broad',
        headerName: t('keywords.table.col_ppc_bid_broad'),
        width: 110,
        type: 'number',
        description: t('keywords.suggestionTabs.comingSoon'),
        valueGetter: (_value, row) => row.js_data?.ppc_bid_broad ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>${params.value.toFixed(2)}</Box>
          ) : (
            <JsPlaceholder />
          ),
      },
      {
        field: 'sp_brand_ad_bid',
        headerName: t('keywords.table.col_sp_brand_ad_bid'),
        width: 120,
        type: 'number',
        description: t('keywords.suggestionTabs.comingSoon'),
        valueGetter: (_value, row) => row.js_data?.sp_brand_ad_bid ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>${params.value.toFixed(2)}</Box>
          ) : (
            <JsPlaceholder />
          ),
      },
      {
        field: 'relevancy_score',
        headerName: t('keywords.table.col_relevancy_score'),
        width: 110,
        type: 'number',
        description: t('keywords.suggestionTabs.comingSoon'),
        valueGetter: (_value, row) => row.js_data?.relevancy_score ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>{params.value}/10</Box>
          ) : (
            <JsPlaceholder />
          ),
      },
      {
        field: 'sponsored_product_count',
        headerName: t('keywords.table.col_sponsored_product_count'),
        width: 130,
        type: 'number',
        description: t('keywords.suggestionTabs.comingSoon'),
        valueGetter: (_value, row) => row.js_data?.sponsored_product_count ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>{params.value.toLocaleString()}</Box>
          ) : (
            <JsPlaceholder />
          ),
      },
      {
        field: 'dominant_category',
        headerName: t('keywords.table.col_dominant_category'),
        width: 160,
        description: t('keywords.suggestionTabs.comingSoon'),
        valueGetter: (_value, row) => row.js_data?.dominant_category ?? '',
        renderCell: (params) =>
          params.value ? params.value : <JsPlaceholder />,
      },
      {
        field: 'recommended_promotions',
        headerName: t('keywords.table.col_recommended_promotions'),
        width: 130,
        type: 'number',
        description: t('keywords.suggestionTabs.comingSoon'),
        valueGetter: (_value, row) => row.js_data?.recommended_promotions ?? null,
        renderCell: (params) =>
          params.value != null ? (
            <Box sx={{ fontFamily: MONO_FONT_STACK }}>{params.value}</Box>
          ) : (
            <JsPlaceholder />
          ),
      },
    ];

    return allCols.filter((col) => {
      const key = col.field as keyof KeywordColumnVisibility;
      return columnVisibility[key] !== false;
    });
  }, [t, columnVisibility, onKeywordClick, onSearchKeyword, onEnrichSingle, isEnriching, handleRefreshCount, isScraping, handleCopyKeyword]);

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
    <Box
      sx={(theme) => ({
        height: 'calc(100vh - 420px)',
        minHeight: 300,
        borderRadius: '10px',
        border: `1px solid ${theme.vars.palette.divider}`,
        overflow: 'hidden',
      })}
    >
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
        pageSizeOptions={[25]}
        sx={(theme) => ({
          border: 'none',
          height: '100%',
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: theme.vars.palette.background.paper,
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.06),
          },
          '& .MuiDataGrid-row:nth-of-type(even)': {
            backgroundColor: alpha(theme.palette.text.primary, 0.015),
          },
          '& .MuiDataGrid-row.Mui-selected': {
            backgroundColor: alpha(theme.palette.primary.main, 0.10),
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.14),
            },
          },
          '& .MuiDataGrid-cell': {
            borderBottom: `1px solid ${theme.vars.palette.divider}`,
          },
          '& .MuiDataGrid-row:hover .keyword-hover-actions': {
            opacity: 1,
          },
        })}
      />
    </Box>
  );
};
