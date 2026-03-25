"""
Pydantic response models for the forecasting API.

These are consumed by forecast_routes.py and returned to the frontend.
All date fields use Python date objects (serialised as 'YYYY-MM-DD' strings
by FastAPI's JSON encoder, which is what Chart.js expects on the x-axis).
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Building blocks
# ---------------------------------------------------------------------------

class WeeklyPoint(BaseModel):
    """A single (week, value) pair for chart rendering."""
    week_start: date
    value: float


class ConfidenceBand(BaseModel):
    """Paired lower/upper bounds for a single confidence level."""
    lower: Optional[float]
    upper: Optional[float]


# ---------------------------------------------------------------------------
# Per-category forecast result
# ---------------------------------------------------------------------------

class CategoryForecast(BaseModel):
    """
    Complete forecast data for one category, ready for the frontend chart.

    Fields:
        category        Canonical category name (e.g. 'Canned Goods').
        data_status     Readiness tier: 'insufficient' | 'limited' |
                        'adequate' | 'good'.
        model_type      Model used: 'ETS' | 'Croston' | 'NaiveMean' | None.
        weeks_of_history  Number of ISO weeks in the training window.
        historical      Actual weekly outflow (is_historical=True rows).
                        Sorted chronologically.  The chart renders these
                        as a solid line up to today.
        forecast        Predicted weekly values (is_historical=False rows).
                        Sorted chronologically.  Rendered as a dashed line.
        ci_80           Per-forecast-step 80 % interval bounds.
                        None entries when intervals are unavailable (Croston).
        ci_95           Per-forecast-step 95 % interval bounds.
    """
    category: str
    data_status: str
    model_type: Optional[str]
    weeks_of_history: int
    historical: List[WeeklyPoint]
    forecast: List[WeeklyPoint]
    ci_80: List[ConfidenceBand]
    ci_95: List[ConfidenceBand]


# ---------------------------------------------------------------------------
# Top-level GET /forecasts/category response
# ---------------------------------------------------------------------------

class ForecastResponse(BaseModel):
    """
    Full response for GET /forecasts/category.

    model_health summarises whether the current run's accuracy is within
    expected bounds:
        'good'     — backtest_wape < warning threshold
        'degraded' — wape > 1.5× 4-run rolling average, or mase > 1.0
        'poor'     — wape > 2× average or mase > 1.5
        'no_data'  — no completed run exists yet for this bank
    """
    run_id: Optional[str]
    run_timestamp: Optional[str]   # ISO 8601 string for JSON serialisation
    bank_id: int
    model_health: str
    weeks_ahead: int
    is_stale: bool                 # True if a background retrain was queued
    categories: List[CategoryForecast]


# ---------------------------------------------------------------------------
# POST /forecasts/run response
# ---------------------------------------------------------------------------

class RunTriggeredResponse(BaseModel):
    """Returned immediately when a run is enqueued or started."""
    run_id: str
    status: str     # 'started' (sync) or 'queued' (background)
    message: str


# ---------------------------------------------------------------------------
# GET /forecasts/runs — run history list
# ---------------------------------------------------------------------------

class ForecastRunSummary(BaseModel):
    """Summary of a single past forecast run."""
    run_id: str
    run_timestamp: str
    model_type: str
    status: str
    weeks_of_history: int
    weeks_ahead: int
    backtest_wape: Optional[float]
    backtest_mase: Optional[float]
    backtest_mae: Optional[float]
    training_start: Optional[date]
    training_end: Optional[date]
    per_category: Optional[Dict[str, Any]]   # model_params JSONB


class ForecastRunsResponse(BaseModel):
    runs: List[ForecastRunSummary]


# ---------------------------------------------------------------------------
# GET /forecasts/aggregate — bank-level total distribution volume
# ---------------------------------------------------------------------------

class AggregatePoint(BaseModel):
    """A single weekly data point in the bank-level aggregate series."""
    week_start: date
    value: float
    is_historical: bool
    ci_lower_80: Optional[float]
    ci_upper_80: Optional[float]


class AggregateForecastResponse(BaseModel):
    """
    Bank-level weekly total distribution volume: historical actuals + forecast.

    Computed by summing all per-category point forecasts (and CI bounds) for
    each ISO week.  CI bounds are summed across categories (conservative: assumes
    full positive correlation between categories).

    data_status mirrors the majority data_status across categories:
        'insufficient' — most categories lack enough history
        'limited'      — some categories have 5-7 weeks
        'adequate'     — most have 8-12 weeks
        'good'         — most have 12+ weeks
    """
    run_id: Optional[str]
    run_timestamp: Optional[str]
    bank_id: int
    data_status: str
    model_health: str
    is_stale: bool
    points: List[AggregatePoint]
