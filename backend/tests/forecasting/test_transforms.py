"""
Unit tests for app.forecasting.transforms and app.category_mappings.normalize_category.

Covers:
  - normalize_category: exact match, case variants, keyword fallback, unknown → "Other"
  - to_weekly_series: aggregation, zero-filling, category normalisation in-flight
  - check_data_status: all four tiers
  - intermittency_ratio: zero-heavy vs sparse series
"""

import pytest
import pandas as pd
from datetime import datetime, timezone

from app.category_mappings import normalize_category, CANONICAL_CATEGORIES
from app.forecasting.transforms import (
    check_data_status,
    intermittency_ratio,
    iso_week_start,
    to_weekly_series,
    THRESHOLD_INSUFFICIENT,
    THRESHOLD_LIMITED,
    THRESHOLD_ADEQUATE,
)
from app.forecasting.extractor import OutboundRecord


# ---------------------------------------------------------------------------
# normalize_category
# ---------------------------------------------------------------------------

class TestNormalizeCategory:

    def test_exact_match_canonical(self):
        for name in CANONICAL_CATEGORIES:
            assert normalize_category(name) == name

    def test_case_insensitive_match(self):
        assert normalize_category("canned goods") == "Canned Goods"
        assert normalize_category("DAIRY") == "Dairy"
        assert normalize_category("  Produce  ") == "Produce"

    def test_keyword_fallback_for_openFoodFacts_string(self):
        # "canned" is a keyword mapped to "Canned Goods"
        assert normalize_category("canned tomatoes, soups") == "Canned Goods"

    def test_unknown_returns_other(self):
        assert normalize_category("xyzzy gibberish") == "Other"

    def test_empty_string_returns_other(self):
        assert normalize_category("") == "Other"

    def test_none_like_empty_returns_other(self):
        assert normalize_category("   ") == "Other"


# ---------------------------------------------------------------------------
# to_weekly_series
# ---------------------------------------------------------------------------

class TestToWeeklySeries:

    def test_empty_records_returns_empty_dict(self):
        assert to_weekly_series([]) == {}

    def test_single_category_aggregates_correctly(self, scenario_regular):
        result = to_weekly_series(scenario_regular)
        assert "Canned Goods" in result
        series = result["Canned Goods"]
        # All values should be non-negative
        assert (series >= 0).all()
        # Index should be a DatetimeIndex of Mondays
        assert isinstance(series.index, pd.DatetimeIndex)
        for ts in series.index:
            assert ts.day_of_week == 0, "All index entries must be Monday"

    def test_zero_fills_missing_weeks(self, base_date):
        """A gap between two records should be zero-filled."""
        records = [
            OutboundRecord(created_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
                           category="Grains", quantity=50),
            # week 2 skipped → should appear as 0
            OutboundRecord(created_at=datetime(2024, 1, 15, tzinfo=timezone.utc),
                           category="Grains", quantity=40),
        ]
        result = to_weekly_series(records)
        series = result["Grains"]
        assert len(series) == 3   # weeks 1, 2 (zero), 3
        assert series.iloc[1] == 0.0

    def test_category_normalisation_unifies_variants(self, scenario_category_variants):
        """Mixed case and variant spellings of 'Canned Goods' must produce one series."""
        result = to_weekly_series(scenario_category_variants)
        # Should only have one key: "Canned Goods"
        assert list(result.keys()) == ["Canned Goods"]
        series = result["Canned Goods"]
        # 12 records across 12 weeks, each with qty=30
        assert len(series) == 12
        assert (series == 30.0).all()

    def test_multiple_records_same_week_are_summed(self, base_date):
        """Two OUTBOUND movements in the same week for the same category sum together."""
        monday = datetime(2024, 1, 1, tzinfo=timezone.utc)
        records = [
            OutboundRecord(created_at=monday, category="Snacks", quantity=10),
            OutboundRecord(created_at=monday.replace(hour=14), category="Snacks", quantity=25),
        ]
        result = to_weekly_series(records)
        assert result["Snacks"].iloc[0] == 35.0


# ---------------------------------------------------------------------------
# check_data_status
# ---------------------------------------------------------------------------

class TestCheckDataStatus:

    def _series(self, values):
        dates = pd.date_range("2024-01-01", periods=len(values), freq="W-MON")
        return pd.Series(values, index=dates, dtype=float)

    def test_insufficient_too_few_weeks(self):
        s = self._series([10, 0, 5, 20, 0, 8])   # 6 weeks < 8
        assert check_data_status(s) == "insufficient"

    def test_insufficient_too_few_nonzero(self):
        # 10 weeks but only 2 non-zero → below MIN_NONZERO_WEEKS=3
        s = self._series([0, 0, 0, 0, 0, 0, 0, 0, 10, 20])
        assert check_data_status(s) == "insufficient"

    def test_limited(self):
        # THRESHOLD_INSUFFICIENT (8) ≤ n < THRESHOLD_LIMITED (12)
        s = self._series([10, 0, 5, 20, 15, 0, 8, 12])   # exactly 8
        assert check_data_status(s) == "limited"

    def test_adequate(self):
        # THRESHOLD_LIMITED (12) ≤ n < THRESHOLD_ADEQUATE (26)
        values = [max(0, v) for v in range(1, 13)]   # 12 non-zero
        s = self._series(values)
        assert check_data_status(s) == "adequate"

    def test_good(self):
        # n ≥ THRESHOLD_ADEQUATE (26)
        values = list(range(1, 27))
        s = self._series(values)
        assert check_data_status(s) == "good"

    def test_cold_start_insufficient(self, scenario_cold_start):
        result = to_weekly_series(scenario_cold_start)
        if result:
            series = next(iter(result.values()))
            assert check_data_status(series) == "insufficient"


# ---------------------------------------------------------------------------
# intermittency_ratio
# ---------------------------------------------------------------------------

class TestIntermittencyRatio:

    def _series(self, values):
        dates = pd.date_range("2024-01-01", periods=len(values), freq="W-MON")
        return pd.Series(values, index=dates, dtype=float)

    def test_all_zeros(self):
        s = self._series([0, 0, 0, 0])
        assert intermittency_ratio(s) == 1.0

    def test_no_zeros(self):
        s = self._series([10, 20, 30, 40])
        assert intermittency_ratio(s) == 0.0

    def test_half_zeros(self):
        s = self._series([10, 0, 20, 0])
        assert intermittency_ratio(s) == 0.5

    def test_empty_series(self):
        assert intermittency_ratio(pd.Series([], dtype=float)) == 1.0

    def test_intermittent_scenario_exceeds_threshold(self, scenario_intermittent):
        """The intermittent fixture should trigger Croston selection (ratio > 0.30)."""
        result = to_weekly_series(scenario_intermittent)
        if result:
            series = next(iter(result.values()))
            assert intermittency_ratio(series) > 0.30
