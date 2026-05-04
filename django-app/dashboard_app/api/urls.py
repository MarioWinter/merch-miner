from django.urls import path

from dashboard_app.api.views import (
    DashboardView,
    DesignAnalyticsView,
    ListingAnalyticsView,
    AgentAnalyticsView,
    SearchAnalyticsView,
    DesignAnalyticsExportView,
    ListingAnalyticsExportView,
    AgentAnalyticsExportView,
    SearchAnalyticsExportView,
)

urlpatterns = [
    # Main dashboard
    path('dashboard/', DashboardView.as_view(), name='dashboard'),

    # Analytics endpoints (admin only)
    path('dashboard/analytics/designs/', DesignAnalyticsView.as_view(), name='dashboard_design_analytics'),
    path('dashboard/analytics/listings/', ListingAnalyticsView.as_view(), name='dashboard_listing_analytics'),
    path('dashboard/analytics/agent/', AgentAnalyticsView.as_view(), name='dashboard_agent_analytics'),
    path('dashboard/analytics/search/', SearchAnalyticsView.as_view(), name='dashboard_search_analytics'),

    # CSV exports (admin only)
    path('dashboard/analytics/designs/export/', DesignAnalyticsExportView.as_view(), name='dashboard_design_export'),
    path('dashboard/analytics/listings/export/', ListingAnalyticsExportView.as_view(), name='dashboard_listing_export'),
    path('dashboard/analytics/agent/export/', AgentAnalyticsExportView.as_view(), name='dashboard_agent_export'),
    path('dashboard/analytics/search/export/', SearchAnalyticsExportView.as_view(), name='dashboard_search_export'),
]
