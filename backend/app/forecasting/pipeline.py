"""
Forecasting pipeline orchestrator.

Public API used by the route layer:
  run_forecast(bank_id, db, weeks_ahead) → str   run_id
  is_stale(bank_id, db, stale_days)      → bool
  has_running_job(bank_id, db)           → bool

run_forecast() is designed to be safe to call either synchronously (e.g. in
a test or via POST /forecasts/run) or as a FastAPI BackgroundTask.  When
called as a background task the request session will already be closed, so
callers using BackgroundTasks must pass a *new* session created from
SessionLocal, not the request-scoped session from Depends(get_db).

Pipeline steps:
  1. Create a ForecastRun row with status='running' and commit immediately
     so concurrent callers see there is a job in flight.
  2. Extract OUTBOUND movements from inventory_movement (extractor.py).
  3. Aggregate into per-category ISO-weekly series (transforms.py).
  4. For each category:
       a. Classify data readiness (check_data_status).
       b. Always persist historical actuals as is_historical=True rows in
          forecast_values so the frontend can render the full history line.
       c. If 'insufficient', skip modelling for this category.
       d. Run expanding-window backtest to get quality metrics.
       e. Select and fit ETS or Croston (falling back to NaiveMean on error).
       f. Generate forecast and confidence intervals.
       g. Persist forecast rows as is_historical=False.
  5. Update the ForecastRun row with aggregate metrics and status='completed'.
  6. Prune runs beyond MAX_RUNS_PER_BANK (oldest deleted first; cascade
     removes their forecast_values automatically).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set

import numpy as np
from sqlalchemy.orm import Session

from app.forecasting.extractor import extract_outbound
from app.forecasting.models import (
    NaiveMeanForecaster,
    rolling_backtest,
    select_forecaster,
)
from app.forecasting.transforms import check_data_status, to_weekly_series
from app.models.forecast import ForecastRun, ForecastValue

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Number of completed runs to retain per food bank.
# Older runs (and their forecast_values via CASCADE) are deleted automatically.
MAX_RUNS_PER_BANK: int = 12

# Default forecast horizon (weeks ahead)
DEFAULT_WEEKS_AHEAD: int = 8

# A run is considered stale when its training_end is older than this many days.
DEFAULT_STALE_DAYS: int = 7


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def run_forecast(
    bank_id: int,
    db: Session,
    weeks_ahead: int = DEFAULT_WEEKS_AHEAD,
    triggered_by_user_id: Optional[int] = None,
) -> str:
    """
    Run the full forecasting pipeline for *bank_id*.

    Creates a ForecastRun record (status='running') before doing any work so
    concurrent callers see there is already a job in flight.  On completion
    the record is updated to status='completed'.  On unhandled exception the
    record is updated to status='failed' and the exception is re-raised.

    Args:
        bank_id:             Food bank to forecast for.
        db:                  SQLAlchemy session.  Must be open for the
                             entire call.  When used as a BackgroundTask
                             pass a new SessionLocal() session, not the
                             request-scoped Depends(get_db) session.
        weeks_ahead:         How many weeks into the future to forecast.
        triggered_by_user_id: User who triggered the run (None for auto).

    Returns:
        run_id string (UUID).
    """
    run_id = str(uuid.uuid4())
    now = datetime.now(tz=timezone.utc)

    # Step 1 — create the run record immediately so concurrent checks work
    run_record = ForecastRun(
        run_id=run_id,
        bank_id=bank_id,
        run_timestamp=now,
        model_type="PENDING",
        granularity="category_week",
        location_scope="all",
        weeks_of_history=0,
        weeks_ahead=weeks_ahead,
        training_start=date.today(),
        training_end=date.today(),
        status="running",
        created_by=triggered_by_user_id,
    )
    db.add(run_record)
    db.commit()

    try:
        _execute_pipeline(run_id, bank_id, weeks_ahead, run_record, db)
    except Exception as exc:
        run_record.status = "failed"
        run_record.error_message = str(exc)[:1000]
        db.commit()
        raise

    return run_id


def is_stale(bank_id: int, db: Session, stale_days: int = DEFAULT_STALE_DAYS) -> bool:
    """
    Return True if the most recent *completed* run for *bank_id* is older
    than *stale_days*, or if no completed run exists at all.

    Used by GET /forecasts/category to decide whether to enqueue a
    background retraining after responding with the cached forecast.
    """
    latest = (
        db.query(ForecastRun)
        .filter(
            ForecastRun.bank_id == bank_id,
            ForecastRun.status == "completed",
        )
        .order_by(ForecastRun.run_timestamp.desc())
        .first()
    )
    if latest is None:
        return True

    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=stale_days)
    run_ts = latest.run_timestamp
    # Normalise to UTC if naive (shouldn't happen, but guard anyway)
    if run_ts.tzinfo is None:
        run_ts = run_ts.replace(tzinfo=timezone.utc)
    return run_ts < cutoff


def has_running_job(bank_id: int, db: Session) -> bool:
    """
    Return True if there is already a run in status='running' for *bank_id*.

    Used to avoid spawning duplicate background tasks when many users open
    the dashboard simultaneously.
    """
    return (
        db.query(ForecastRun)
        .filter(
            ForecastRun.bank_id == bank_id,
            ForecastRun.status == "running",
        )
        .first()
    ) is not None


# ---------------------------------------------------------------------------
# Internal pipeline execution
# ---------------------------------------------------------------------------

def _execute_pipeline(
    run_id: str,
    bank_id: int,
    weeks_ahead: int,
    run_record: ForecastRun,
    db: Session,
) -> None:
    """
    Inner pipeline logic called by run_forecast() after the run record is
    committed.  Separated from the public function to keep error handling
    clean.
    """
    # Step 2 — extract
    records = extract_outbound(bank_id, db)
    if not records:
        _finalise_run(run_record, model_type="NaiveMean", db=db)
        _prune_old_runs(bank_id, run_id, db)
        return

    # Step 3 — transform
    series_map = to_weekly_series(records)
    if not series_map:
        _finalise_run(run_record, model_type="NaiveMean", db=db)
        _prune_old_runs(bank_id, run_id, db)
        return

    # Step 4 — per-category modelling
    aggregate_wape: List[float] = []
    aggregate_mase: List[float] = []
    aggregate_mae: List[float] = []
    model_types_used: Set[str] = set()
    per_cat_params: Dict[str, Any] = {}

    overall_training_start: Optional[date] = None
    overall_training_end: Optional[date] = None
    total_history_weeks: int = 0

    forecast_value_rows: List[ForecastValue] = []

    for category, series in series_map.items():
        data_status = check_data_status(series)

        # Determine the training date range for this category
        series_dates = [
            ts.date() if hasattr(ts, "date") else ts
            for ts in series.index
        ]
        if series_dates:
            cat_start, cat_end = min(series_dates), max(series_dates)
            if overall_training_start is None or cat_start < overall_training_start:
                overall_training_start = cat_start
            if overall_training_end is None or cat_end > overall_training_end:
                overall_training_end = cat_end
            total_history_weeks = max(total_history_weeks, len(series_dates))

        # --- Persist historical actuals (always, regardless of data_status) ---
        for week_ts, qty in series.items():
            week_date: date = week_ts.date() if hasattr(week_ts, "date") else week_ts
            forecast_value_rows.append(
                ForecastValue(
                    run_id=run_id,
                    bank_id=bank_id,
                    entity_type="category",
                    entity_id=None,
                    entity_name=category,
                    week_start=week_date,
                    is_historical=True,
                    point_forecast=round(float(qty), 2),
                )
            )

        # --- Skip modelling if not enough data ---
        if data_status == "insufficient":
            per_cat_params[category] = {
                "model_type": "none",
                "data_status": data_status,
            }
            continue

        # --- Backtest ---
        backtest_metrics = rolling_backtest(series)

        # --- Fit primary model ---
        forecaster = select_forecaster(series)
        try:
            forecaster.fit(series)
        except Exception:
            # Graceful fallback: naive mean never fails on non-empty data
            forecaster = NaiveMeanForecaster()
            forecaster.fit(series)

        model_types_used.add(forecaster.name)
        per_cat_params[category] = {
            "model_type": forecaster.name,
            "data_status": data_status,
            "params": forecaster.get_params(),
        }

        # Collect aggregate metrics from backtest
        if backtest_metrics.get("wape_avg") is not None:
            aggregate_wape.append(backtest_metrics["wape_avg"])
        if backtest_metrics.get("mase_avg") is not None:
            aggregate_mase.append(backtest_metrics["mase_avg"])
        if backtest_metrics.get("mae_avg") is not None:
            aggregate_mae.append(backtest_metrics["mae_avg"])

        # --- Generate forecast ---
        forecast_result = forecaster.predict(steps=weeks_ahead)

        for h, (week_ts, pred_val) in enumerate(forecast_result.point.items(), start=1):
            week_date = week_ts.date() if hasattr(week_ts, "date") else week_ts
            forecast_value_rows.append(
                ForecastValue(
                    run_id=run_id,
                    bank_id=bank_id,
                    entity_type="category",
                    entity_id=None,
                    entity_name=category,
                    week_start=week_date,
                    is_historical=False,
                    point_forecast=round(float(pred_val), 2),
                    ci_lower_80=(
                        round(float(forecast_result.lower_80.iloc[h - 1]), 2)
                        if forecast_result.lower_80 is not None else None
                    ),
                    ci_upper_80=(
                        round(float(forecast_result.upper_80.iloc[h - 1]), 2)
                        if forecast_result.upper_80 is not None else None
                    ),
                    ci_lower_95=(
                        round(float(forecast_result.lower_95.iloc[h - 1]), 2)
                        if forecast_result.lower_95 is not None else None
                    ),
                    ci_upper_95=(
                        round(float(forecast_result.upper_95.iloc[h - 1]), 2)
                        if forecast_result.upper_95 is not None else None
                    ),
                    horizon_weeks=h,
                )
            )

    # Step 5 — bulk insert all forecast value rows, then update run record
    db.add_all(forecast_value_rows)

    model_type_str = (
        "/".join(sorted(model_types_used)) if model_types_used else "NaiveMean"
    )
    run_record.model_type = model_type_str
    run_record.model_params = per_cat_params
    run_record.weeks_of_history = total_history_weeks
    run_record.training_start = overall_training_start or date.today()
    run_record.training_end = overall_training_end or date.today()
    run_record.backtest_wape = (
        round(float(np.mean(aggregate_wape)), 4) if aggregate_wape else None
    )
    run_record.backtest_mase = (
        round(float(np.mean(aggregate_mase)), 4) if aggregate_mase else None
    )
    run_record.backtest_mae = (
        round(float(np.mean(aggregate_mae)), 4) if aggregate_mae else None
    )
    run_record.status = "completed"
    db.commit()

    # Step 6 — prune old runs (CASCADE removes their forecast_values)
    _prune_old_runs(bank_id, run_id, db)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _finalise_run(
    run_record: ForecastRun,
    model_type: str,
    db: Session,
) -> None:
    """Mark a run completed with no forecast data (empty bank)."""
    run_record.model_type = model_type
    run_record.status = "completed"
    db.commit()


def _prune_old_runs(bank_id: int, current_run_id: str, db: Session) -> None:
    """
    Delete forecast runs beyond MAX_RUNS_PER_BANK for this bank, oldest first.

    ON DELETE CASCADE in the database schema handles the corresponding
    forecast_values rows automatically.
    """
    all_runs: List[ForecastRun] = (
        db.query(ForecastRun)
        .filter(ForecastRun.bank_id == bank_id)
        .order_by(ForecastRun.run_timestamp.desc())
        .all()
    )
    to_delete = all_runs[MAX_RUNS_PER_BANK:]
    for old_run in to_delete:
        db.delete(old_run)
    if to_delete:
        db.commit()
