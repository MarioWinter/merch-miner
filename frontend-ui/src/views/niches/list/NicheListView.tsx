import { useState, useEffect } from 'react';
import { Box, Button, Pagination, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { useListNichesQuery, useDeleteNicheMutation } from '../../../store/nicheSlice';
import { useNicheFilters } from './hooks/useNicheFilters';
import { useNicheDrawer } from './hooks/useNicheDrawer';
import { useNicheSelection } from './hooks/useNicheSelection';
import { useInlineEdit } from './hooks/useInlineEdit';
import { useInlineAdd } from './hooks/useInlineAdd';
import { NicheFilterToolbar } from './partials/NicheFilterToolbar';
import { NicheTable } from './partials/NicheTable';
import { TableSkeleton } from './partials/TableSkeleton';
import { EmptyState } from './partials/EmptyState';
import { NicheDetailDrawer } from './partials/NicheDetailDrawer';
import { BulkActionBar } from './partials/BulkActionBar';
import { useSnackbar } from 'notistack';
import type { NicheListParams } from './types';

const SIDEBAR_COLLAPSED_KEY = 'mm-sidebar-collapsed';

const useSidebarCollapsed = (): boolean => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handler = () => {
      try {
        setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true');
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return collapsed;
};

const PAGE_SIZE = 20;

const PageHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(2),
}));

const PaginationRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(2),
}));

const ErrorBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(8),
  gap: theme.spacing(1.5),
  textAlign: 'center',
}));

const NicheListView = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const sidebarCollapsed = useSidebarCollapsed();

  const filterState = useNicheFilters();
  const { filters, setOrdering, resetFilters, setPage } = filterState;

  const { drawerState, openCreate, openEdit, closeDrawer } = useNicheDrawer();
  const selection = useNicheSelection();
  const inlineEdit = useInlineEdit();
  const inlineAdd = useInlineAdd();

  const queryParams: NicheListParams = {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.status_group ? { status_group: filters.status_group } : {}),
    ...(filters.potential_rating ? { potential_rating: filters.potential_rating } : {}),
    ...(filters.assigned_to ? { assigned_to: filters.assigned_to } : {}),
    ...(filters.ordering ? { ordering: filters.ordering } : {}),
    page: filters.page,
    page_size: PAGE_SIZE,
  };

  const { data, isLoading, isError, isFetching } = useListNichesQuery(queryParams);

  const [deleteNiche] = useDeleteNicheMutation();

  const handleArchive = async (id: string) => {
    try {
      await deleteNiche(id).unwrap();
      enqueueSnackbar(t('niches.notifications.archiveSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('niches.notifications.archiveError'), { variant: 'error' });
    }
  };

  const hasFilters = filterState.activeFilterCount > 0;
  const niches = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);

  const showSkeleton = isLoading || (isFetching && niches.length === 0);
  const showEmpty = !isLoading && !isError && niches.length === 0;
  const showTable = !isLoading && !isError && niches.length > 0;

  return (
    <Box sx={{ pb: 8 }}>
      <PageHeader>
        <Typography component="h1" variant="h4" fontWeight={700}>
          {t('niches.pageTitle')}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={openCreate}
          aria-label={t('niches.newNiche')}
        >
          {t('niches.newNiche')}
        </Button>
      </PageHeader>

      <NicheFilterToolbar filterState={filterState} />

      {isError && (
        <ErrorBox role="alert">
          <Typography variant="h6" color="text.secondary">
            {t('niches.notifications.createError')}
          </Typography>
          <Typography variant="body2" color="text.disabled">
            {t('niches.empty.noResultsHint')}
          </Typography>
        </ErrorBox>
      )}

      {showSkeleton && <TableSkeleton />}

      {showEmpty && (
        <EmptyState
          hasFilters={hasFilters}
          onNewNiche={openCreate}
          onClearFilters={resetFilters}
        />
      )}

      {showTable && (
        <NicheTable
          niches={niches}
          ordering={filters.ordering}
          onOrderingChange={setOrdering}
          selection={selection}
          onRowClick={openEdit}
          onArchive={handleArchive}
          inlineEdit={inlineEdit}
          inlineAdd={inlineAdd}
        />
      )}

      {pageCount > 1 && (
        <PaginationRow>
          <Pagination
            count={pageCount}
            page={filters.page}
            onChange={(_, page) => setPage(page)}
            color="primary"
            size="small"
            aria-label="Niche list pagination"
          />
        </PaginationRow>
      )}

      <NicheDetailDrawer
        open={drawerState.open}
        mode={drawerState.mode}
        selectedId={drawerState.selectedId}
        onClose={closeDrawer}
      />

      <BulkActionBar selection={selection} sidebarCollapsed={sidebarCollapsed} />
    </Box>
  );
};

export default NicheListView;
