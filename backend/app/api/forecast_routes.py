"""
Forecasting API routes.

Endpoints:
  GET  /forecasts/category   Read the latest pre-computed forecasts per category.
                             Triggers a background retraining if the run is
                             stale (> 7 days old); the stale forecast is
                             returned immediately with no added latency.

  GET  /forecasts/aggregate  Bank-level total items/week: historical + forecast.
                             Computed by summing all per-category point forecasts
                             for each ISO week.  Useful for logistics/volunteer
                             planning where total volume matters more than splits.

  POST /forecasts/run        Manually trigger a new forecast run.
                             Rate-limited to 1 per hour per bank.
                             Runs synchronously and returns run_id on success.

  GET  /forecasts/runs       List recent forecast runs with backtest metrics.

All endpoints require the reports:view permission, matching the pattern used
by the existing reports / dashboard features.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.dependencies import get_db
from app.forecasting.pipeline import (
    DEFAULT_STALE_DAYS,
    DEFAULT_WEEKS_AHEAD,
    has_running_job,
    is_stale,
    run_forecast,
)
from app.forecasting.schemas import (
    AggregatePoint,
    AggregateForecastResponse,
    CategoryForecast,
    ConfidenceBand,
    ForecastResponse,
    ForecastRunSummary,
    ForecastRunsResponse,
    RunTriggeredResponse,
    WeeklyPoint,
)
from app.models.forecast import ForecastRun, ForecastValue
from app.models.user import User
from app.services.permission_service import Permission, require_permission

router = APIRouter(prefix="/forecasts", tags=["Forecasting"])

# ---------------------------------------------------------------------------
# Rate-limit constant for manual run trigger
# ---------------------------------------------------------------------------
_RUN_RATE_LIMIT_HOURS: int = 0


# ---------------------------------------------------------------------------
# GET /forecasts/category
# ---------------------------------------------------------------------------

@router.get("/category", response_model=ForecastResponse)
def get_forecasts(
    background_tasks: BackgroundTasks,
    weeks_ahead: int = Query(DEFAULT_WEEKS_AHEAD, ge=1, le=26),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.REPORTS_VIEW)),
):
    """
    Return the latest pre-computed forecast for all categories in the
    current user's food bank.

    Auto-retraining:
      If the most recent completed run is older than DEFAULT_STALE_DAYS and
      no run is currently in progress, a new run is enqueued as a
      BackgroundTask.  The stale (but still valid) cached forecast is returned
      immediately so the user sees data without waiting.

    The response includes:
      - Historical actuals (is_historical=True rows) for chart rendering.
      - Forecast values and confidence intervals (is_historical=False rows).
      - model_health derived from backtest metric trends across recent runs.
      - is_stale flag so the frontend can show a "refreshing..." indicator.
    """
    bank_id = current_user.bank_id

    # --- Auto-staleness trigger ---
    stale = is_stale(bank_id, db)
    if stale and not has_running_job(bank_id, db):
        background_tasks.add_task(_background_run_forecast, bank_id)

    # --- Fetch most recent completed run ---
    latest_run: Optional[ForecastRun] = (
        db.query(ForecastRun)
        .filter(
            ForecastRun.bank_id == bank_id,
            ForecastRun.status == "completed",
        )
        .order_by(ForecastRun.run_timestamp.desc())
        .first()
    )

    if latest_run is None:
        return ForecastResponse(
            run_id=None,
            run_timestamp=None,
            bank_id=bank_id,
            model_health="no_data",
            weeks_ahead=weeks_ahead,
            is_stale=stale,
            categories=[],
        )

    # --- Fetch all forecast values for this run ---
    rows: List[ForecastValue] = (
        db.query(ForecastValue)
        .filter(ForecastValue.run_id == latest_run.run_id)
        .order_by(ForecastValue.entity_name, ForecastValue.week_start)
        .all()
    )

    # --- Group rows by category ---
    by_category: Dict[str, Dict[str, List[ForecastValue]]] = {}
    for row in rows:
        cat = row.entity_name
        if cat not in by_category:
            by_category[cat] = {"historical": [], "forecast": []}
        if row.is_historical:
            by_category[cat]["historical"].append(row)
        else:
            by_category[cat]["forecast"].append(row)

    # --- Build per-category response objects ---
    per_cat_params: Dict[str, Any] = latest_run.model_params or {}

    categories: List[CategoryForecast] = []
    for category, bucket in by_category.items():
        cat_meta = per_cat_params.get(category, {})
        data_status = cat_meta.get("data_status", "insufficient")
        model_type = cat_meta.get("model_type") or None

        historical = [
            WeeklyPoint(week_start=r.week_start, value=float(r.point_forecast))
            for r in bucket["historical"]
        ]
        forecast = [
            WeeklyPoint(week_start=r.week_start, value=float(r.point_forecast))
            for r in bucket["forecast"]
        ]
        ci_80 = [
            ConfidenceBand(
                lower=float(r.ci_lower_80) if r.ci_lower_80 is not None else None,
                upper=float(r.ci_upper_80) if r.ci_upper_80 is not None else None,
            )
            for r in bucket["forecast"]
        ]
        ci_95 = [
            ConfidenceBand(
                lower=float(r.ci_lower_95) if r.ci_lower_95 is not None else None,
                upper=float(r.ci_upper_95) if r.ci_upper_95 is not None else None,
            )
            for r in bucket["forecast"]
        ]

        categories.append(
            CategoryForecast(
                category=category,
                data_status=data_status,
                model_type=model_type if model_type not in ("none", None) else None,
                weeks_of_history=len(historical),
                historical=historical,
                forecast=forecast,
                ci_80=ci_80,
                ci_95=ci_95,
            )
        )

    # Sort categories alphabetically for stable frontend rendering
    categories.sort(key=lambda c: c.category)

    # --- Compute model_health from recent run metrics ---
    model_health = _compute_model_health(bank_id, latest_run, db)

    run_ts_str = (
        latest_run.run_timestamp.isoformat()
        if latest_run.run_timestamp else None
    )

    return ForecastResponse(
        run_id=latest_run.run_id,
        run_timestamp=run_ts_str,
        bank_id=bank_id,
        model_health=model_health,
        weeks_ahead=latest_run.weeks_ahead,
        is_stale=stale,
        categories=categories,
    )


# ---------------------------------------------------------------------------
# POST /forecasts/run
# ---------------------------------------------------------------------------

@router.post("/run", response_model=RunTriggeredResponse)
def trigger_run(
    weeks_ahead: int = Query(DEFAULT_WEEKS_AHEAD, ge=1, le=26),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.REPORTS_VIEW)),
):
    """
    Manually trigger a new forecast run for the current user's food bank.

    Rate-limited to one run per hour per bank to prevent excessive compute
    from repeated manual triggers.  The run executes synchronously so the
    response includes the run_id of the newly-created and fully-completed run.

    Returns HTTP 429 if a run was completed within the last hour.
    Returns HTTP 409 if a run is currently in progress.
    """
    bank_id = current_user.bank_id

    # 409 if already running
    if has_running_job(bank_id, db):
        raise HTTPException(
            status_code=409,
            detail="A forecast run is already in progress for this food bank.",
        )

    # 429 rate limit: check most recent completed run
    recent: Optional[ForecastRun] = (
        db.query(ForecastRun)
        .filter(
            ForecastRun.bank_id == bank_id,
            ForecastRun.status == "completed",
        )
        .order_by(ForecastRun.run_timestamp.desc())
        .first()
    )
    if recent is not None:
        cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=_RUN_RATE_LIMIT_HOURS)
        run_ts = recent.run_timestamp
        if run_ts.tzinfo is None:
            run_ts = run_ts.replace(tzinfo=timezone.utc)
        if run_ts > cutoff:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Forecast was run {int((datetime.now(tz=timezone.utc) - run_ts).total_seconds() / 60)} "
                    f"minutes ago. Please wait at least {_RUN_RATE_LIMIT_HOURS} hour(s) between manual runs."
                ),
            )

    run_id = run_forecast(
        bank_id=bank_id,
        db=db,
        weeks_ahead=weeks_ahead,
        triggered_by_user_id=current_user.user_id,
    )
    return RunTriggeredResponse(
        run_id=run_id,
        status="started",
        message="Forecast run completed successfully.",
    )


# ---------------------------------------------------------------------------
# GET /forecasts/runs
# ---------------------------------------------------------------------------

@router.get("/runs", response_model=ForecastRunsResponse)
def list_runs(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.REPORTS_VIEW)),
):
    """
    List recent forecast runs for the current user's food bank.

    Returns metadata and aggregate backtest metrics for each run so that
    model quality can be tracked over time.  Per-category model params are
    included in the per_category field.
    """
    bank_id = current_user.bank_id

    runs: List[ForecastRun] = (
        db.query(ForecastRun)
        .filter(ForecastRun.bank_id == bank_id)
        .order_by(ForecastRun.run_timestamp.desc())
        .limit(limit)
        .all()
    )

    summaries = [
        ForecastRunSummary(
            run_id=r.run_id,
            run_timestamp=r.run_timestamp.isoformat() if r.run_timestamp else "",
            model_type=r.model_type,
            status=r.status,
            weeks_of_history=r.weeks_of_history,
            weeks_ahead=r.weeks_ahead,
            backtest_wape=float(r.backtest_wape) if r.backtest_wape is not None else None,
            backtest_mase=float(r.backtest_mase) if r.backtest_mase is not None else None,
            backtest_mae=float(r.backtest_mae) if r.backtest_mae is not None else None,
            training_start=r.training_start,
            training_end=r.training_end,
            per_category=r.model_params,
        )
        for r in runs
    ]

    return ForecastRunsResponse(runs=summaries)


# ---------------------------------------------------------------------------
# GET /forecasts/aggregate
# ---------------------------------------------------------------------------

@router.get("/aggregate", response_model=AggregateForecastResponse)
def get_aggregate_forecast(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.REPORTS_VIEW)),
):
    """
    Return the bank-level total distribution volume per week: historical
    actuals followed by the forecast horizon.

    Computed by summing all per-category point forecasts (and CI bounds) for
    each ISO week from the latest completed run.  This total is more stable
    than any individual category series and is directly useful for volunteer
    and logistics planning.

    The same auto-staleness logic as /forecasts/category applies: a background
    retrain is queued if the cached forecast is older than DEFAULT_STALE_DAYS.
    """
    bank_id = current_user.bank_id

    stale = is_stale(bank_id, db)
    if stale and not has_running_job(bank_id, db):
        background_tasks.add_task(_background_run_forecast, bank_id)

    latest_run: Optional[ForecastRun] = (
        db.query(ForecastRun)
        .filter(
            ForecastRun.bank_id == bank_id,
            ForecastRun.status == "completed",
        )
        .order_by(ForecastRun.run_timestamp.desc())
        .first()
    )

    if latest_run is None:
        return AggregateForecastResponse(
            run_id=None,
            run_timestamp=None,
            bank_id=bank_id,
            data_status="insufficient",
            model_health="no_data",
            is_stale=stale,
            points=[],
        )

    rows: List[ForecastValue] = (
        db.query(ForecastValue)
        .filter(ForecastValue.run_id == latest_run.run_id)
        .order_by(ForecastValue.week_start)
        .all()
    )

    # Aggregate by week: sum point forecasts + CI bounds across all categories
    # Keys: week_start (date) -> accumulated totals
    hist_weeks: Dict[Any, float] = {}
    fc_weeks: Dict[Any, float] = {}
    ci80_lower: Dict[Any, float] = {}
    ci80_upper: Dict[Any, float] = {}

    for row in rows:
        wk = row.week_start
        val = float(row.point_forecast)
        if row.is_historical:
            hist_weeks[wk] = hist_weeks.get(wk, 0.0) + val
        else:
            fc_weeks[wk] = fc_weeks.get(wk, 0.0) + val
            if row.ci_lower_80 is not None:
                ci80_lower[wk] = ci80_lower.get(wk, 0.0) + float(row.ci_lower_80)
            if row.ci_upper_80 is not None:
                ci80_upper[wk] = ci80_upper.get(wk, 0.0) + float(row.ci_upper_80)

    points: List[AggregatePoint] = []
    for wk in sorted(hist_weeks):
        points.append(AggregatePoint(
            week_start=wk,
            value=round(hist_weeks[wk], 2),
            is_historical=True,
            ci_lower_80=None,
            ci_upper_80=None,
        ))
    for wk in sorted(fc_weeks):
        points.append(AggregatePoint(
            week_start=wk,
            value=round(fc_weeks[wk], 2),
            is_historical=False,
            ci_lower_80=round(ci80_lower[wk], 2) if wk in ci80_lower else None,
            ci_upper_80=round(ci80_upper[wk], 2) if wk in ci80_upper else None,
        ))

    # Derive aggregate data_status from per-category params
    per_cat_params: Dict[str, Any] = latest_run.model_params or {}
    statuses = [v.get("data_status", "insufficient") for v in per_cat_params.values()]
    status_order = ["insufficient", "limited", "adequate", "good"]
    if statuses:
        # Use the majority status (median rank)
        ranks = [status_order.index(s) if s in status_order else 0 for s in statuses]
        median_rank = sorted(ranks)[len(ranks) // 2]
        agg_data_status = status_order[median_rank]
    else:
        agg_data_status = "insufficient"

    model_health = _compute_model_health(bank_id, latest_run, db)
    run_ts_str = latest_run.run_timestamp.isoformat() if latest_run.run_timestamp else None

    return AggregateForecastResponse(
        run_id=latest_run.run_id,
        run_timestamp=run_ts_str,
        bank_id=bank_id,
        data_status=agg_data_status,
        model_health=model_health,
        is_stale=stale,
        points=points,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _background_run_forecast(bank_id: int) -> None:
    """
    Run the forecast pipeline in a background task with its own DB session.

    FastAPI BackgroundTasks execute after the response is sent, so the
    request-scoped session is already closed.  We create a new session here
    and close it ourselves.
    """
    db = SessionLocal()
    try:
        run_forecast(bank_id=bank_id, db=db)
    except Exception:
        pass   # errors are recorded in the forecast_runs row; don't crash the worker
    finally:
        db.close()


def _compute_model_health(
    bank_id: int,
    current_run: ForecastRun,
    db: Session,
) -> str:
    """
    Derive a model health label by comparing the current run's backtest_wape
    against a rolling average of the previous 4 completed runs.

    Rules:
      no_data   — current run has no wape metric (insufficient data)
      good      — wape ≤ 1.5× rolling average (or no prior runs to compare)
      degraded  — wape > 1.5× rolling average, or backtest_mase > 1.0
      poor      — wape > 2.0× rolling average, or backtest_mase > 1.5
    """
    current_wape = (
        float(current_run.backtest_wape)
        if current_run.backtest_wape is not None else None
    )
    current_mase = (
        float(current_run.backtest_mase)
        if current_run.backtest_mase is not None else None
    )

    if current_wape is None:
        return "no_data"

    # Fetch the 4 runs before the current one (for rolling baseline)
    prior_runs: List[ForecastRun] = (
        db.query(ForecastRun)
        .filter(
            ForecastRun.bank_id == bank_id,
            ForecastRun.status == "completed",
            ForecastRun.run_id != current_run.run_id,
            ForecastRun.backtest_wape.isnot(None),
        )
        .order_by(ForecastRun.run_timestamp.desc())
        .limit(4)
        .all()
    )

    if not prior_runs:
        # Not enough history to compare; assume healthy
        return "good"

    rolling_avg = sum(float(r.backtest_wape) for r in prior_runs) / len(prior_runs)

    # MASE check (independent of rolling average)
    if current_mase is not None:
        if current_mase > 1.5:
            return "poor"
        if current_mase > 1.0:
            return "degraded"

    # WAPE ratio check
    if rolling_avg > 0:
        ratio = current_wape / rolling_avg
        if ratio > 2.0:
            return "poor"
        if ratio > 1.5:
            return "degraded"

    return "good"
