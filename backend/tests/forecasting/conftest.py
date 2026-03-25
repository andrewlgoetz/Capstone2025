"""
Synthetic data fixtures for forecasting unit tests.

All generators produce OutboundRecord lists that can be passed directly to
app.forecasting.transforms.to_weekly_series().

Design rules:
  - No database connections; all data is in-memory Python objects.
  - Use a fixed random seed so tests are deterministic.
  - Each scenario corresponds to a plan-documented validation case.
  - Synthetic data is never written to seed_db.py or any real fixture.
"""

from datetime import datetime, timedelta, timezone
from typing import List

import numpy as np
import pytest

from app.forecasting.extractor import OutboundRecord


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

def _monday(base: datetime, week_offset: int) -> datetime:
    """Return the Monday of *week_offset* weeks from *base* (UTC, midnight)."""
    d = base - timedelta(days=base.weekday())          # this Monday
    d = d + timedelta(weeks=week_offset)
    return d.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)


def _records(values: List[float], category: str, base: datetime) -> List[OutboundRecord]:
    """
    Build one OutboundRecord per week from a list of weekly demand values.
    Weeks with value 0 produce no record (zero demand → no OUTBOUND movement).
    """
    records = []
    for i, v in enumerate(values):
        if v > 0:
            records.append(
                OutboundRecord(
                    created_at=_monday(base, i),
                    category=category,
                    quantity=int(round(v)),
                )
            )
    return records


# ---------------------------------------------------------------------------
# Scenario fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def base_date() -> datetime:
    """Reference Monday (2024-01-01).  All synthetic series start from here."""
    return datetime(2024, 1, 1, tzinfo=timezone.utc)


@pytest.fixture
def scenario_regular(base_date) -> List[OutboundRecord]:
    """
    Scenario 1 — Regular demand with gentle upward trend.
    24 weeks of data; ETS should outperform naive mean.
    """
    rng = np.random.default_rng(42)
    trend = np.linspace(40, 60, 24)
    noise = rng.normal(0, 5, 24)
    values = np.clip(trend + noise, 1, None)
    return _records(values.tolist(), "Canned Goods", base_date)


@pytest.fixture
def scenario_intermittent(base_date) -> List[OutboundRecord]:
    """
    Scenario 2 — Intermittent demand: ~60 % zero weeks, Poisson demand spikes.
    Croston TSB should be selected (intermittency > 30 %).
    """
    rng = np.random.default_rng(7)
    weeks = 24
    # Each week: 40 % chance of demand, Poisson(15) when it occurs
    demand_flag = rng.binomial(1, 0.4, weeks)
    demand_size = rng.poisson(15, weeks)
    values = (demand_flag * demand_size).tolist()
    return _records(values, "Fresh Produce", base_date)


@pytest.fixture
def scenario_cold_start(base_date) -> List[OutboundRecord]:
    """
    Scenario 5 — Cold start: only 5 weeks of data.
    data_status must be 'insufficient'; no forecast should be generated.
    """
    values = [20, 0, 15, 22, 18]
    return _records(values, "Beverages", base_date)


@pytest.fixture
def scenario_demand_spike(base_date) -> List[OutboundRecord]:
    """
    Scenario 4 — Sudden demand spike at week 20 (5× normal), then recovery.
    Validates ETS adapts back toward baseline within a few weeks.
    """
    rng = np.random.default_rng(13)
    values = rng.normal(30, 3, 26).tolist()
    values[20] = 150.0   # spike
    values = [max(0, v) for v in values]
    return _records(values, "Grains", base_date)


@pytest.fixture
def scenario_category_variants(base_date) -> List[OutboundRecord]:
    """
    Scenario 6 — Category string normalisation.
    Mix of canonical and variant spellings for the same category.
    normalize_category() must unify them into one series.
    """
    records = []
    # Canonical spelling
    for i in range(8):
        records.append(OutboundRecord(
            created_at=_monday(base_date, i),
            category="Canned Goods",
            quantity=30,
        ))
    # Variant spellings that should all normalise to "Canned Goods"
    variants = ["CANNED GOODS", "canned goods", "Canned goods", "canned"]
    for j, variant in enumerate(variants, start=8):
        records.append(OutboundRecord(
            created_at=_monday(base_date, j),
            category=variant,
            quantity=30,
        ))
    return records


@pytest.fixture
def scenario_adequate(base_date) -> List[OutboundRecord]:
    """
    16 weeks of steady demand — should hit 'adequate' data_status and
    allow full ETS fitting + rolling backtest.
    """
    rng = np.random.default_rng(99)
    values = rng.normal(50, 8, 16).clip(1).tolist()
    return _records(values, "Dairy", base_date)
