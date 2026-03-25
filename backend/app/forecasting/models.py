"""
Forecasting model implementations for the demand pipeline.

Models provided:
  NaiveMeanForecaster  — 4-week rolling mean.  Required baseline; used as
                         production fallback when ETS/Croston fails to fit.
  ETSForecaster        — Holt-Winters Exponential Smoothing via statsmodels.
                         Primary model for series with < 30 % zero weeks.
  CrostonTSBForecaster — Teunter-Syntetos-Babai variant of Croston's method.
                         Purpose-built for intermittent demand (≥ 30 % zeros).

Model selection:
  select_forecaster(series) → BaseForecaster
      Returns Croston when intermittency > 30 %, ETS otherwise.

Rolling backtest:
  rolling_backtest(series, ...) → Dict[str, float]
      Expanding-window evaluation; returns per-horizon and aggregate metrics
      (MAE, WAPE, MASE) that are stored in forecast_runs and used by the
      model health indicator.
"""

from __future__ import annotations

import warnings
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------

@dataclass
class ForecastResult:
    """
    Point forecasts and optional prediction intervals for a single series.

    All Series have a DatetimeIndex of future ISO Monday dates (freq='W-MON').
    Values in *point* are clipped to ≥ 0 before being stored here.
    CI bounds may be None (Croston v1, or when simulation fails).
    """
    point: pd.Series                    # shape (steps,)
    lower_80: Optional[pd.Series] = None
    upper_80: Optional[pd.Series] = None
    lower_95: Optional[pd.Series] = None
    upper_95: Optional[pd.Series] = None
    model_params: Dict[str, Any] = field(default_factory=dict)
    model_name: str = "Unknown"


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------

class BaseForecaster(ABC):
    name: str = "Base"

    @abstractmethod
    def fit(self, series: pd.Series) -> None:
        """Fit the model on a complete historical series."""

    @abstractmethod
    def predict(self, steps: int) -> ForecastResult:
        """Generate *steps* weeks of forecasts from the end of the training series."""

    def get_params(self) -> Dict[str, Any]:
        """Return a JSON-serialisable dict of fitted parameters."""
        return {}


# ---------------------------------------------------------------------------
# Naive baseline: 4-week rolling mean
# ---------------------------------------------------------------------------

class NaiveMeanForecaster(BaseForecaster):
    """
    4-week rolling mean of the most recent observations.

    This is the required baseline: every other model must beat it.
    It is also used as a fallback if ETS or Croston fails to fit.
    """
    name = "NaiveMean"

    def __init__(self, window: int = 4) -> None:
        self.window = window
        self._mean: float = 0.0
        self._training_index: Optional[pd.DatetimeIndex] = None

    def fit(self, series: pd.Series) -> None:
        self._training_index = series.index
        self._mean = max(0.0, float(series.tail(self.window).mean()))

    def predict(self, steps: int) -> ForecastResult:
        if self._training_index is None:
            raise RuntimeError("fit() must be called before predict()")
        future_dates = pd.date_range(
            start=self._training_index[-1] + pd.Timedelta(weeks=1),
            periods=steps,
            freq="W-MON",
        )
        point = pd.Series([self._mean] * steps, index=future_dates, dtype=float)
        return ForecastResult(
            point=point,
            model_params=self.get_params(),
            model_name=self.name,
        )

    def get_params(self) -> Dict[str, Any]:
        return {"window": self.window, "last_mean": round(self._mean, 4)}


# ---------------------------------------------------------------------------
# ETS (Holt-Winters Exponential Smoothing)
# ---------------------------------------------------------------------------

class ETSForecaster(BaseForecaster):
    """
    Exponential Smoothing via statsmodels HoltWintersExponentialSmoothing.

    Configuration choices:
      - trend='add' when series has ≥ 12 observations; None otherwise.
        (Too few points → trend parameter estimation is unreliable.)
      - seasonal=None always in v1; seasonal models need ≥ 52 weeks.
      - initialization_method='estimated' → statsmodels fits initial state
        by MLE alongside the smoothing parameters.
      - remove_bias=True → corrects for the positive bias that can appear
        in short series with additive error.

    Prediction intervals are produced by bootstrapping 500 simulated paths
    from the fitted model via HoltWintersResultsWrapper.simulate().
    If simulation fails for any reason the forecast is still returned, just
    without CI bounds.
    """
    name = "ETS"
    _N_SIMULATIONS: int = 500

    def __init__(self) -> None:
        self._fit_result = None
        self._training_index: Optional[pd.DatetimeIndex] = None
        self._trend_used: Optional[str] = None

    def fit(self, series: pd.Series) -> None:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing

        self._training_index = series.index
        values = series.values.astype(float)

        # Only use additive trend when there is enough data for stable estimation.
        # Damped trend prevents runaway extrapolation beyond the training window —
        # the forecast converges toward a flat level rather than projecting a steep
        # trend indefinitely.
        trend = "add" if len(values) >= 12 else None
        use_damped = trend is not None
        self._trend_used = trend

        def _build_model():
            return ExponentialSmoothing(
                values,
                trend=trend,
                damped_trend=use_damped,
                seasonal=None,
                initialization_method="estimated",
            )

        # Pass 1: unconstrained optimisation to find the natural alpha.
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            free_result = _build_model().fit(optimized=True, remove_bias=True)

        alpha = free_result.params.get("smoothing_level", 0.3)
        alpha = float(alpha) if alpha is not None and not np.isnan(float(alpha)) else 0.3

        # Pass 2 (only when needed): if alpha degenerated to last-value territory
        # (> 0.60), re-fit with alpha fixed at 0.40.  statsmodels still optimises
        # the initial level, trend, and damping parameters with alpha held constant.
        # This retains at least 60 % of the historical memory in every forecast.
        if alpha > 0.60:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                self._fit_result = _build_model().fit(
                    optimized=True,
                    smoothing_level=0.40,
                    remove_bias=True,
                )
        else:
            self._fit_result = free_result

    def predict(self, steps: int) -> ForecastResult:
        if self._fit_result is None or self._training_index is None:
            raise RuntimeError("fit() must be called before predict()")

        future_dates = pd.date_range(
            start=self._training_index[-1] + pd.Timedelta(weeks=1),
            periods=steps,
            freq="W-MON",
        )

        # Point forecast — clip to zero (demand cannot be negative)
        raw_point = self._fit_result.forecast(steps)
        point = pd.Series(np.clip(raw_point, 0, None), index=future_dates)

        # Bootstrap prediction intervals
        lower_80 = upper_80 = lower_95 = upper_95 = None
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                # simulate() returns shape (steps, repetitions)
                sims = self._fit_result.simulate(
                    nsimulations=steps,
                    repetitions=self._N_SIMULATIONS,
                    error="add",
                    random_state=42,
                )
            sims = np.clip(sims, 0, None)
            lower_80 = pd.Series(np.percentile(sims, 10, axis=1), index=future_dates)
            upper_80 = pd.Series(np.percentile(sims, 90, axis=1), index=future_dates)
            lower_95 = pd.Series(np.percentile(sims, 2.5, axis=1), index=future_dates)
            upper_95 = pd.Series(np.percentile(sims, 97.5, axis=1), index=future_dates)
        except Exception:
            # Intervals are optional; a forecast without CI is still useful
            pass

        return ForecastResult(
            point=point,
            lower_80=lower_80,
            upper_80=upper_80,
            lower_95=lower_95,
            upper_95=upper_95,
            model_params=self.get_params(),
            model_name=self.name,
        )

    def get_params(self) -> Dict[str, Any]:
        if self._fit_result is None:
            return {}
        params: Dict[str, Any] = {"trend": self._trend_used}
        result_params = getattr(self._fit_result, "params", {}) or {}
        for attr in ("smoothing_level", "smoothing_trend", "initial_level", "initial_trend"):
            val = result_params.get(attr)
            if val is not None and not (isinstance(val, float) and np.isnan(val)):
                params[attr] = round(float(val), 6)
        return params


# ---------------------------------------------------------------------------
# Croston TSB (Teunter-Syntetos-Babai)
# ---------------------------------------------------------------------------

class CrostonTSBForecaster(BaseForecaster):
    """
    TSB variant of Croston's method for intermittent demand series.

    Unlike the original Croston (1972) method, TSB models the *probability*
    of non-zero demand directly (p_t) rather than the inter-demand interval.
    This avoids the well-known non-decaying demand probability bias.

    State variables:
      p_t  — probability of a non-zero demand event in period t
      z_t  — expected demand size given demand occurs

    Update equations at each period t:
      If y_t > 0:
        p_t = (1 - α₁) · p_{t-1} + α₁ · 1
        z_t = (1 - α₂) · z_{t-1} + α₂ · y_t
      If y_t = 0:
        p_t = (1 - α₁) · p_{t-1}         (probability decays when no demand)
        z_t = z_{t-1}                      (size estimate unchanged)

    Forecast at any horizon h:  ŷ_{t+h} = p_t · z_t  (constant)

    Parameters α₁ and α₂ are optimised by minimising the sum of squared
    one-step-ahead forecast errors using L-BFGS-B (available via scipy,
    which is a transitive dependency of statsmodels).

    Initialisation:
      p_0 = fraction of non-zero observations in the series
      z_0 = mean of non-zero observations (or 1.0 if all zeros)

    v1 limitation: no prediction intervals (bootstrapping Croston is
    non-trivial; deferred to v2).
    """
    name = "Croston"

    def __init__(self, alpha1: float = 0.2, alpha2: float = 0.3) -> None:
        self.alpha1 = alpha1   # smoothing for demand probability
        self.alpha2 = alpha2   # smoothing for demand size
        self._p: float = 0.5  # fitted final probability
        self._z: float = 1.0  # fitted final size
        self._training_index: Optional[pd.DatetimeIndex] = None

    # ------------------------------------------------------------------
    # Core TSB simulation (static so it can be called from the optimiser
    # without capturing self, keeping things thread-safe)
    # ------------------------------------------------------------------

    @staticmethod
    def _simulate(
        values: np.ndarray, alpha1: float, alpha2: float
    ) -> Tuple[float, float, np.ndarray]:
        """
        Run TSB through *values* with the given parameters.

        Returns:
            p_final   — probability estimate after the last observation
            z_final   — size estimate after the last observation
            fitted    — one-step-ahead forecasts (same length as values)
        """
        n = len(values)
        nonzero = values[values > 0]
        p = float((values > 0).mean()) if n > 0 else 0.5
        z = float(nonzero.mean()) if len(nonzero) > 0 else 1.0

        fitted = np.empty(n)
        for t in range(n):
            fitted[t] = p * z          # forecast before seeing y_t
            if values[t] > 0:
                p = (1.0 - alpha1) * p + alpha1 * 1.0
                z = (1.0 - alpha2) * z + alpha2 * float(values[t])
            else:
                p = (1.0 - alpha1) * p
                # z unchanged when no demand occurs

        return p, z, fitted

    def fit(self, series: pd.Series) -> None:
        from scipy.optimize import minimize

        self._training_index = series.index
        values = series.values.astype(float)

        def sse(params: np.ndarray) -> float:
            a1, a2 = float(params[0]), float(params[1])
            _, _, fitted = self._simulate(values, a1, a2)
            return float(np.sum((values - fitted) ** 2))

        result = minimize(
            sse,
            x0=np.array([self.alpha1, self.alpha2]),
            method="L-BFGS-B",
            bounds=[(0.05, 0.95), (0.05, 0.95)],
        )
        self.alpha1 = float(result.x[0])
        self.alpha2 = float(result.x[1])
        self._p, self._z, _ = self._simulate(values, self.alpha1, self.alpha2)

    def predict(self, steps: int) -> ForecastResult:
        if self._training_index is None:
            raise RuntimeError("fit() must be called before predict()")

        future_dates = pd.date_range(
            start=self._training_index[-1] + pd.Timedelta(weeks=1),
            periods=steps,
            freq="W-MON",
        )
        # TSB forecast is constant across all horizons
        forecast_value = max(0.0, self._p * self._z)
        point = pd.Series([forecast_value] * steps, index=future_dates, dtype=float)

        return ForecastResult(
            point=point,
            # No CI for Croston in v1
            model_params=self.get_params(),
            model_name=self.name,
        )

    def get_params(self) -> Dict[str, Any]:
        return {
            "alpha1": round(self.alpha1, 6),
            "alpha2": round(self.alpha2, 6),
            "p_final": round(self._p, 6),
            "z_final": round(self._z, 6),
        }


# ---------------------------------------------------------------------------
# Model selection
# ---------------------------------------------------------------------------

def select_forecaster(series: pd.Series) -> BaseForecaster:
    """
    Choose the appropriate model based on intermittency of the series.

    Rule: if more than 30 % of weeks have zero demand, use Croston TSB;
    otherwise use ETS.  This threshold is a well-established heuristic in
    intermittent demand literature (Syntetos & Boylan, 2005).
    """
    from app.forecasting.transforms import intermittency_ratio
    return CrostonTSBForecaster() if intermittency_ratio(series) > 0.30 else ETSForecaster()


# ---------------------------------------------------------------------------
# Rolling backtest
# ---------------------------------------------------------------------------

def rolling_backtest(
    series: pd.Series,
    min_train: int = 8,
    horizons: Optional[List[int]] = None,
) -> Dict[str, float]:
    """
    Expanding-window backtest for a single time series.

    For each step t from min_train to len(series)-1:
      - Train on series[:t]
      - Predict up to max(horizons) steps ahead
      - Collect (actual, predicted) pairs for each horizon h where t+h-1 < n

    Metrics computed per horizon:
      mae_h{h}   Mean Absolute Error
      wape_h{h}  Weighted Absolute Percentage Error  (sum|e| / sum|actual|)
      mase_h{h}  Mean Absolute Scaled Error scaled by naive MAE on training

    Aggregate metrics (mean across horizons):
      mae_avg, wape_avg, mase_avg

    Returns an empty dict if the series is too short to backtest.

    WAPE is preferred over MAPE because it handles zero actuals cleanly
    (divides by the sum of actuals rather than per-observation actual).
    """
    if horizons is None:
        horizons = [1, 2, 4]

    n = len(series)
    min_backtest_steps = 4

    if n < min_train + min_backtest_steps:
        return {}

    values = series.values.astype(float)

    # Collect (actual, predicted) pairs per horizon
    errors_per_h: Dict[int, List[Tuple[float, float]]] = {h: [] for h in horizons}

    for t in range(min_train, n):
        train_slice = series.iloc[:t]
        forecaster = select_forecaster(train_slice)
        try:
            forecaster.fit(train_slice)
            result = forecaster.predict(steps=max(horizons))
        except Exception:
            continue   # skip unstable fits rather than aborting the whole backtest

        for h in horizons:
            future_idx = t + h - 1
            if future_idx < n:
                actual = values[future_idx]
                pred = max(0.0, float(result.point.iloc[h - 1]))
                errors_per_h[h].append((actual, pred))

    # Naive MAE for MASE denominator: mean |y_t - y_{t-1}| on the initial
    # training window (one-step random walk baseline)
    naive_diffs = np.abs(np.diff(values[:min_train]))
    naive_mae = float(np.mean(naive_diffs)) if len(naive_diffs) > 0 and np.mean(naive_diffs) > 0 else 1.0

    metrics: Dict[str, Any] = {}
    for h in horizons:
        pairs = errors_per_h[h]
        if not pairs:
            continue
        actuals = np.array([p[0] for p in pairs])
        preds = np.array([p[1] for p in pairs])
        abs_errors = np.abs(actuals - preds)

        mae = float(np.mean(abs_errors))
        sum_actual = float(np.sum(actuals))
        wape = float(np.sum(abs_errors) / sum_actual) if sum_actual > 0 else None
        mase = mae / naive_mae

        metrics[f"mae_h{h}"] = round(mae, 4)
        metrics[f"wape_h{h}"] = round(wape, 4) if wape is not None else None
        metrics[f"mase_h{h}"] = round(mase, 4)

    # Aggregate summary across horizons
    mae_vals  = [v for k, v in metrics.items() if k.startswith("mae_h")  and v is not None]
    wape_vals = [v for k, v in metrics.items() if k.startswith("wape_h") and v is not None]
    mase_vals = [v for k, v in metrics.items() if k.startswith("mase_h") and v is not None]

    if mae_vals:
        metrics["mae_avg"]  = round(float(np.mean(mae_vals)),  4)
    if wape_vals:
        metrics["wape_avg"] = round(float(np.mean(wape_vals)), 4)
    if mase_vals:
        metrics["mase_avg"] = round(float(np.mean(mase_vals)), 4)

    return metrics
