"""
Data transformation layer for the forecasting pipeline.

Responsibilities:
  1. Normalize raw inventory.category strings to the 11 canonical names via
     category_mappings.normalize_category.
  2. Aggregate per-movement records into ISO-weekly time series per category,
     zero-filling weeks with no activity.
  3. Classify series readiness (data_status) and intermittency ratio so the
     model selection layer can make informed choices.
"""

from datetime import date, timedelta
from typing import Dict, List

import pandas as pd

from app.category_mappings import normalize_category
from app.forecasting.extractor import OutboundRecord


# ---------------------------------------------------------------------------
# Thresholds (number of weeks)
# ---------------------------------------------------------------------------
# Below INSUFFICIENT: no forecast shown, just a "not enough data" message.
THRESHOLD_INSUFFICIENT: int = 8
# Below LIMITED: forecast shown with a wide-uncertainty disclaimer.
THRESHOLD_LIMITED: int = 12
# Below ADEQUATE: forecast shown without disclaimer, intervals may still vary.
THRESHOLD_ADEQUATE: int = 26
# 26+ weeks → 'good'.  52+ weeks unlocks seasonal models (handled in model layer).

# Minimum number of distinct OUTBOUND movements (non-zero weeks) required
# to attempt any forecast.
MIN_NONZERO_WEEKS: int = 3


def iso_week_start(dt: object) -> date:
    """
    Return the ISO Monday (week start) for a datetime or date object.

    Python's weekday() returns 0 for Monday, so subtracting weekday() days
    always lands on the Monday of that ISO week.
    """
    d: date = dt.date() if hasattr(dt, "date") else dt  # type: ignore[union-attr]
    return d - timedelta(days=d.weekday())


def to_weekly_series(
    records: List[OutboundRecord],
) -> Dict[str, pd.Series]:
    """
    Convert raw outbound records into per-category ISO-weekly time series.

    Steps:
      1. Normalise each record's category string.
      2. Assign each record to its ISO week start (Monday).
      3. Aggregate (sum) quantities per (category, week).
      4. Build a complete date range from the earliest to latest week seen
         across all records, then reindex each category series against it,
         filling missing weeks with 0.

    Returns:
        Dict mapping canonical category name → pd.Series where:
          - index: pd.DatetimeIndex of ISO Monday dates (no gaps)
          - values: float (total absolute outflow that week, ≥ 0)
        An empty dict is returned when records is empty.
    """
    if not records:
        return {}

    rows = [
        {
            "week_start": pd.Timestamp(iso_week_start(r.created_at)),
            "category": normalize_category(r.category),
            "quantity": float(r.quantity),
        }
        for r in records
    ]

    df = pd.DataFrame(rows)

    # Aggregate: sum quantities per (category, week)
    weekly = (
        df.groupby(["category", "week_start"])["quantity"]
        .sum()
        .reset_index()
    )

    # Full date range spanning all categories (shared x-axis for the chart)
    all_weeks = pd.date_range(
        start=df["week_start"].min(),
        end=df["week_start"].max(),
        freq="W-MON",
    )

    result: Dict[str, pd.Series] = {}
    for category in weekly["category"].unique():
        cat_df = (
            weekly[weekly["category"] == category]
            .set_index("week_start")["quantity"]
        )
        # Reindex over the full shared range, zero-filling missing weeks
        series = cat_df.reindex(all_weeks, fill_value=0.0)
        result[category] = series

    return result


def check_data_status(series: pd.Series) -> str:
    """
    Classify how much data a series has, determining what the UI shows.

    Returns one of:
      'insufficient' — fewer than THRESHOLD_INSUFFICIENT weeks or too few
                       non-zero entries; no forecast rendered.
      'limited'      — 8–11 weeks; forecast shown with wide-uncertainty note.
      'adequate'     — 12–25 weeks; standard forecast with intervals.
      'good'         — 26+ weeks; full forecast, no caveats.
    """
    n_weeks = len(series)
    n_nonzero = int((series > 0).sum())

    if n_weeks < THRESHOLD_INSUFFICIENT or n_nonzero < MIN_NONZERO_WEEKS:
        return "insufficient"
    if n_weeks < THRESHOLD_LIMITED:
        return "limited"
    if n_weeks < THRESHOLD_ADEQUATE:
        return "adequate"
    return "good"


def intermittency_ratio(series: pd.Series) -> float:
    """
    Fraction of weeks with zero demand.

    Used by the model selection layer: series with > 30 % zero weeks are
    better served by Croston TSB than by ETS.

    Returns 1.0 for an empty series (worst-case intermittency).
    """
    if len(series) == 0:
        return 1.0
    return float((series == 0).sum()) / len(series)
