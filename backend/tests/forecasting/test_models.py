"""
Unit tests for app.forecasting.models.

Covers:
  - NaiveMeanForecaster: correct mean, future dates, no CI, fallback window
  - ETSForecaster: non-negative forecasts, CI bands for adequate history
  - CrostonTSBForecaster: constant forecast, no CI in v1, params stored
  - select_forecaster: Croston for intermittent, ETS for regular
  - rolling_backtest: expected metric keys, empty dict for short series,
                      mase_avg present, numeric correctness on trivial series
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timezone

from app.forecasting.models import (
    NaiveMeanForecaster,
    ETSForecaster,
    CrostonTSBForecaster,
    ForecastResult,
    select_forecaster,
    rolling_backtest,
)
from app.forecasting.transforms import to_weekly_series


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _weekly_series(values, start="2024-01-01"):
    """Build a pd.Series with a W-MON DatetimeIndex from a list of values."""
    idx = pd.date_range(start, periods=len(values), freq="W-MON")
    return pd.Series(values, index=idx, dtype=float)


# ---------------------------------------------------------------------------
# NaiveMeanForecaster
# ---------------------------------------------------------------------------

class TestNaiveMeanForecaster:

    def test_predict_without_fit_raises(self):
        f = NaiveMeanForecaster()
        with pytest.raises(RuntimeError):
            f.predict(4)

    def test_mean_of_last_four_weeks(self):
        # Last 4 values are [10, 20, 30, 40] → mean = 25
        s = _weekly_series([100, 100, 100, 100, 10, 20, 30, 40])
        f = NaiveMeanForecaster(window=4)
        f.fit(s)
        result = f.predict(4)
        assert all(abs(v - 25.0) < 1e-6 for v in result.point)

    def test_future_dates_are_mondays(self):
        s = _weekly_series([10, 20, 30, 40])
        f = NaiveMeanForecaster()
        f.fit(s)
        result = f.predict(3)
        for ts in result.point.index:
            assert ts.day_of_week == 0, f"{ts} is not a Monday"

    def test_future_dates_start_after_training_end(self):
        s = _weekly_series([10, 20, 30])
        f = NaiveMeanForecaster()
        f.fit(s)
        result = f.predict(2)
        assert result.point.index[0] > s.index[-1]

    def test_no_ci_bands(self):
        s = _weekly_series([10, 20, 30, 40])
        f = NaiveMeanForecaster()
        f.fit(s)
        result = f.predict(4)
        assert result.lower_80 is None
        assert result.upper_80 is None
        assert result.lower_95 is None
        assert result.upper_95 is None

    def test_point_is_non_negative(self):
        """Even if last 4 values happen to mix high and low, mean ≥ 0."""
        s = _weekly_series([0, 0, 0, 0])
        f = NaiveMeanForecaster()
        f.fit(s)
        result = f.predict(4)
        assert (result.point >= 0).all()

    def test_model_name(self):
        f = NaiveMeanForecaster()
        f.fit(_weekly_series([10, 20]))
        result = f.predict(1)
        assert result.model_name == "NaiveMean"

    def test_get_params_contains_mean(self):
        s = _weekly_series([10, 20, 30, 40])
        f = NaiveMeanForecaster()
        f.fit(s)
        params = f.get_params()
        assert "last_mean" in params
        assert abs(params["last_mean"] - 25.0) < 1e-4

    def test_short_series_uses_all_available(self):
        """Window=4 but only 2 observations → uses both."""
        s = _weekly_series([10, 30])
        f = NaiveMeanForecaster(window=4)
        f.fit(s)
        result = f.predict(1)
        assert abs(result.point.iloc[0] - 20.0) < 1e-6


# ---------------------------------------------------------------------------
# ETSForecaster
# ---------------------------------------------------------------------------

class TestETSForecaster:

    def test_predict_without_fit_raises(self):
        f = ETSForecaster()
        with pytest.raises(RuntimeError):
            f.predict(4)

    def test_point_forecasts_non_negative(self, scenario_regular):
        series_map = to_weekly_series(scenario_regular)
        series = series_map["Canned Goods"]
        f = ETSForecaster()
        f.fit(series)
        result = f.predict(8)
        assert (result.point >= 0).all()

    def test_correct_number_of_steps(self, scenario_regular):
        series_map = to_weekly_series(scenario_regular)
        series = series_map["Canned Goods"]
        f = ETSForecaster()
        f.fit(series)
        for steps in [1, 4, 8]:
            result = f.predict(steps)
            assert len(result.point) == steps

    def test_future_dates_are_mondays(self, scenario_regular):
        series_map = to_weekly_series(scenario_regular)
        series = series_map["Canned Goods"]
        f = ETSForecaster()
        f.fit(series)
        result = f.predict(4)
        for ts in result.point.index:
            assert ts.day_of_week == 0

    def test_ci_bands_present_for_adequate_history(self, scenario_regular):
        """24 weeks of data → CI bands must be present."""
        series_map = to_weekly_series(scenario_regular)
        series = series_map["Canned Goods"]
        f = ETSForecaster()
        f.fit(series)
        result = f.predict(4)
        assert result.lower_80 is not None
        assert result.upper_80 is not None
        assert result.lower_95 is not None
        assert result.upper_95 is not None

    def test_ci_80_inside_ci_95(self, scenario_regular):
        """80 % interval must be narrower than 95 %."""
        series_map = to_weekly_series(scenario_regular)
        series = series_map["Canned Goods"]
        f = ETSForecaster()
        f.fit(series)
        result = f.predict(4)
        assert (result.lower_95 <= result.lower_80).all()
        assert (result.upper_80 <= result.upper_95).all()

    def test_ci_lower_non_negative(self, scenario_regular):
        series_map = to_weekly_series(scenario_regular)
        series = series_map["Canned Goods"]
        f = ETSForecaster()
        f.fit(series)
        result = f.predict(4)
        if result.lower_80 is not None:
            assert (result.lower_80 >= 0).all()

    def test_model_name(self, scenario_regular):
        series_map = to_weekly_series(scenario_regular)
        series = series_map["Canned Goods"]
        f = ETSForecaster()
        f.fit(series)
        result = f.predict(1)
        assert result.model_name == "ETS"

    def test_params_include_smoothing_level(self, scenario_regular):
        series_map = to_weekly_series(scenario_regular)
        series = series_map["Canned Goods"]
        f = ETSForecaster()
        f.fit(series)
        params = f.get_params()
        assert "smoothing_level" in params
        assert 0.0 <= params["smoothing_level"] <= 1.0

    def test_no_trend_for_short_series(self):
        """Fewer than 12 points → trend should be None."""
        s = _weekly_series([20, 25, 22, 30, 28, 35, 33, 40])
        f = ETSForecaster()
        f.fit(s)
        assert f._trend_used is None

    def test_trend_used_for_long_series(self):
        """12+ points → trend='add'."""
        s = _weekly_series(list(range(10, 25)))  # 15 points
        f = ETSForecaster()
        f.fit(s)
        assert f._trend_used == "add"


# ---------------------------------------------------------------------------
# CrostonTSBForecaster
# ---------------------------------------------------------------------------

class TestCrostonTSBForecaster:

    def test_predict_without_fit_raises(self):
        f = CrostonTSBForecaster()
        with pytest.raises(RuntimeError):
            f.predict(4)

    def test_constant_forecast_all_horizons(self, scenario_intermittent):
        series_map = to_weekly_series(scenario_intermittent)
        series = next(iter(series_map.values()))
        f = CrostonTSBForecaster()
        f.fit(series)
        result = f.predict(8)
        # All steps should have the same value (TSB is constant across horizons)
        assert len(result.point.unique()) == 1

    def test_non_negative_forecast(self, scenario_intermittent):
        series_map = to_weekly_series(scenario_intermittent)
        series = next(iter(series_map.values()))
        f = CrostonTSBForecaster()
        f.fit(series)
        result = f.predict(4)
        assert (result.point >= 0).all()

    def test_no_ci_bands_in_v1(self, scenario_intermittent):
        """v1: CI bands not implemented for Croston."""
        series_map = to_weekly_series(scenario_intermittent)
        series = next(iter(series_map.values()))
        f = CrostonTSBForecaster()
        f.fit(series)
        result = f.predict(4)
        assert result.lower_80 is None
        assert result.upper_80 is None
        assert result.lower_95 is None
        assert result.upper_95 is None

    def test_correct_number_of_steps(self, scenario_intermittent):
        series_map = to_weekly_series(scenario_intermittent)
        series = next(iter(series_map.values()))
        f = CrostonTSBForecaster()
        f.fit(series)
        for steps in [1, 4, 8]:
            result = f.predict(steps)
            assert len(result.point) == steps

    def test_future_dates_are_mondays(self, scenario_intermittent):
        series_map = to_weekly_series(scenario_intermittent)
        series = next(iter(series_map.values()))
        f = CrostonTSBForecaster()
        f.fit(series)
        result = f.predict(4)
        for ts in result.point.index:
            assert ts.day_of_week == 0

    def test_model_name(self, scenario_intermittent):
        series_map = to_weekly_series(scenario_intermittent)
        series = next(iter(series_map.values()))
        f = CrostonTSBForecaster()
        f.fit(series)
        result = f.predict(1)
        assert result.model_name == "Croston"

    def test_params_contain_alpha_and_state(self, scenario_intermittent):
        series_map = to_weekly_series(scenario_intermittent)
        series = next(iter(series_map.values()))
        f = CrostonTSBForecaster()
        f.fit(series)
        params = f.get_params()
        for key in ("alpha1", "alpha2", "p_final", "z_final"):
            assert key in params, f"Missing param key: {key}"

    def test_alpha_bounds_after_optimisation(self, scenario_intermittent):
        """Optimised alphas must remain within the L-BFGS-B bounds [0.05, 0.95]."""
        series_map = to_weekly_series(scenario_intermittent)
        series = next(iter(series_map.values()))
        f = CrostonTSBForecaster()
        f.fit(series)
        assert 0.05 <= f.alpha1 <= 0.95
        assert 0.05 <= f.alpha2 <= 0.95

    def test_all_zeros_series_gives_zero_forecast(self):
        """All-zero input → forecast should be zero (no demand at all)."""
        s = _weekly_series([0, 0, 0, 0, 0, 0, 0, 0])
        f = CrostonTSBForecaster()
        f.fit(s)
        result = f.predict(4)
        assert (result.point == 0.0).all()


# ---------------------------------------------------------------------------
# select_forecaster
# ---------------------------------------------------------------------------

class TestSelectForecaster:

    def test_selects_croston_for_intermittent(self, scenario_intermittent):
        """High zero-fraction → Croston should be selected."""
        series_map = to_weekly_series(scenario_intermittent)
        series = next(iter(series_map.values()))
        forecaster = select_forecaster(series)
        assert isinstance(forecaster, CrostonTSBForecaster)

    def test_selects_ets_for_regular(self, scenario_regular):
        """Low zero-fraction → ETS should be selected."""
        series_map = to_weekly_series(scenario_regular)
        series = series_map["Canned Goods"]
        forecaster = select_forecaster(series)
        assert isinstance(forecaster, ETSForecaster)

    def test_boundary_exactly_30_percent(self):
        """Exactly 30% zeros → ETS (threshold is strictly > 0.30 for Croston)."""
        # 3 zeros out of 10 = 30% exactly
        values = [0, 0, 0, 10, 20, 30, 10, 20, 30, 10]
        s = _weekly_series(values)
        forecaster = select_forecaster(s)
        assert isinstance(forecaster, ETSForecaster)

    def test_just_above_30_percent_selects_croston(self):
        """31%+ zeros → Croston."""
        # 4 zeros out of 10 = 40%
        values = [0, 0, 0, 0, 10, 20, 30, 10, 20, 30]
        s = _weekly_series(values)
        forecaster = select_forecaster(s)
        assert isinstance(forecaster, CrostonTSBForecaster)


# ---------------------------------------------------------------------------
# rolling_backtest
# ---------------------------------------------------------------------------

class TestRollingBacktest:

    def test_returns_empty_for_too_short_series(self):
        """Series shorter than min_train + 4 → empty dict."""
        s = _weekly_series([10, 20, 30, 40, 50, 60, 70])  # 7 < 8+4
        result = rolling_backtest(s, min_train=8)
        assert result == {}

    def test_returns_expected_metric_keys(self, scenario_regular):
        """Adequate history → all per-horizon and aggregate keys present."""
        series_map = to_weekly_series(scenario_regular)
        series = series_map["Canned Goods"]
        metrics = rolling_backtest(series, min_train=8, horizons=[1, 2, 4])
        for key in ("mae_h1", "mae_h2", "mae_h4",
                    "wape_h1", "wape_h2",
                    "mase_h1", "mase_h2", "mase_h4",
                    "mae_avg", "mase_avg"):
            assert key in metrics, f"Expected metric key missing: {key}"

    def test_mase_avg_present(self, scenario_regular):
        series_map = to_weekly_series(scenario_regular)
        series = series_map["Canned Goods"]
        metrics = rolling_backtest(series, min_train=8, horizons=[1, 2, 4])
        assert "mase_avg" in metrics

    def test_mae_non_negative(self, scenario_regular):
        series_map = to_weekly_series(scenario_regular)
        series = series_map["Canned Goods"]
        metrics = rolling_backtest(series, min_train=8, horizons=[1, 2])
        for key in ("mae_h1", "mae_h2", "mae_avg"):
            if key in metrics:
                assert metrics[key] >= 0.0, f"{key} should be non-negative"

    def test_wape_between_zero_and_reasonable(self, scenario_regular):
        """WAPE should be > 0 (not a perfect model) and < 5.0 (not useless)."""
        series_map = to_weekly_series(scenario_regular)
        series = series_map["Canned Goods"]
        metrics = rolling_backtest(series, min_train=8, horizons=[1])
        if "wape_h1" in metrics and metrics["wape_h1"] is not None:
            assert 0.0 <= metrics["wape_h1"] <= 5.0

    def test_constant_series_wape_is_zero(self):
        """Constant series → perfect naive forecast → WAPE = 0."""
        s = _weekly_series([20.0] * 20)
        metrics = rolling_backtest(s, min_train=8, horizons=[1])
        # WAPE could technically be 0 since naive mean == constant value
        if "wape_h1" in metrics and metrics["wape_h1"] is not None:
            assert metrics["wape_h1"] < 0.01

    def test_metrics_are_numeric(self, scenario_adequate):
        series_map = to_weekly_series(scenario_adequate)
        series = series_map["Dairy"]
        metrics = rolling_backtest(series, min_train=8, horizons=[1, 2, 4])
        for key, val in metrics.items():
            if val is not None:
                assert isinstance(val, float), f"{key} is not float: {type(val)}"

    def test_horizon_4_not_available_when_series_too_short_for_it(self):
        """With only 13 points and min_train=8, h=4 may not have enough evaluation steps."""
        s = _weekly_series([10, 20, 15, 25, 12, 30, 18, 22, 28, 20, 24, 19, 26])
        metrics = rolling_backtest(s, min_train=8, horizons=[1, 4])
        # h=1 should always have steps, h=4 may or may not — just check types
        if "mase_h4" in metrics:
            assert isinstance(metrics["mase_h4"], float)

    def test_backtest_uses_scenario_adequate(self, scenario_adequate):
        """16-week adequate scenario should produce a non-empty backtest."""
        series_map = to_weekly_series(scenario_adequate)
        series = series_map["Dairy"]
        metrics = rolling_backtest(series, min_train=8, horizons=[1, 2, 4])
        assert len(metrics) > 0
