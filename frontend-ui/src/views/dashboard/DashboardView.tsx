import { Alert, Box, Grid, Skeleton, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import useDashboardData from './hooks/useDashboardData';
import useAnalytics from './hooks/useAnalytics';
import useCSVExport from './hooks/useCSVExport';
import KPICards from './partials/KPICards';
import PipelineFunnel from './partials/PipelineFunnel';
import ActivityFeed from './partials/ActivityFeed';
import StuckNichesWidget from './partials/StuckNichesWidget';
import RoadmapWidget from './partials/RoadmapWidget';
import DesignAnalyticsChart from './partials/DesignAnalyticsChart';
import ListingAnalyticsChart from './partials/ListingAnalyticsChart';
import AgentActivityWidget from './partials/AgentActivityWidget';
import SearchActivityWidget from './partials/SearchActivityWidget';
import DateRangePicker from './partials/DateRangePicker';

const DashboardView = () => {
  const { t } = useTranslation();
  const { dashboard, isLoading: dashLoading, error: dashError } = useDashboardData();
  const {
    dateRange, setDateRange,
    designAnalytics, listingAnalytics,
    isLoading: analyticsLoading,
  } = useAnalytics();
  const { exportCSV } = useCSVExport(dateRange);

  if (dashError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('dashboard.error.loadFailed')}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        {t('dashboard.page.title')}
      </Typography>

      {/* KPI Cards */}
      <KPICards
        nicheCounts={dashboard?.niche_counts ?? null}
        designCounts={dashboard?.design_counts ?? null}
        listingCounts={dashboard?.listing_counts ?? null}
        isLoading={dashLoading}
      />

      {/* Pipeline Funnel + Activity Feed */}
      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, sm: 12, md: 6 }}>
          <PipelineFunnel
            nicheCounts={dashboard?.niche_counts ?? null}
            isLoading={dashLoading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 12, md: 6 }}>
          <ActivityFeed
            events={dashboard?.recent_activity ?? []}
            isLoading={dashLoading}
          />
        </Grid>
      </Grid>

      {/* Stuck Niches */}
      <Box sx={{ mt: 3 }}>
        <StuckNichesWidget
          niches={dashboard?.stuck_niches ?? []}
          isLoading={dashLoading}
        />
      </Box>

      {/* Roadmap + (future) Changelog Widgets */}
      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* FIX-dashboard Phase 7b: temporary half-width slot. Phase 8b ChangelogWidget will share the row. */}
        <Grid size={{ xs: 12, sm: 12, md: 6 }}>
          <RoadmapWidget />
        </Grid>
      </Grid>

      {/* Agent + Search Widgets (from main dashboard data) */}
      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, sm: 12, md: 6 }}>
          <AgentActivityWidget
            data={dashboard?.agent_activity ?? null}
            isLoading={dashLoading}
            onExport={() => exportCSV('agent')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 12, md: 6 }}>
          <SearchActivityWidget
            data={dashboard?.search_activity ?? null}
            isLoading={dashLoading}
            onExport={() => exportCSV('search')}
          />
        </Grid>
      </Grid>

      {/* Analytics Section — Admin only */}
      <Stack spacing={3} sx={{ mt: 5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
          <Typography variant="h5">
            {t('dashboard.analytics.sectionTitle')}
          </Typography>
          <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
        </Stack>

        {analyticsLoading ? (
          <Stack spacing={3}>
            <Skeleton variant="rounded" height={320} />
            <Skeleton variant="rounded" height={320} />
          </Stack>
        ) : (
          <>
            <DesignAnalyticsChart
              data={designAnalytics}
              isLoading={analyticsLoading}
              onExport={() => exportCSV('designs')}
            />
            <ListingAnalyticsChart
              data={listingAnalytics}
              isLoading={analyticsLoading}
              onExport={() => exportCSV('listings')}
            />
          </>
        )}
      </Stack>
    </Box>
  );
};

export default DashboardView;
