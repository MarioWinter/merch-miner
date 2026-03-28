"""
Stuck niche detection — delegates to kpi_aggregator.get_stuck_niches.
Kept as separate module for clarity per tech design.
"""
from dashboard_app.services.kpi_aggregator import get_stuck_niches  # noqa: F401
