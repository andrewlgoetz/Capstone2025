"""
Forecasting models: baselines + gradient boosting.

All models follow sklearn estimator API for consistency.
"""
from typing import Protocol
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor


class ForecastModel(Protocol):
    """Protocol for forecast models."""
    def fit(self, X, y): ...
    def predict(self, X) -> np.ndarray: ...


class NaiveLastValue:
    """Baseline: predict tomorrow = today's value (lag_1)."""
    
    def __init__(self):
        self.lag_col_idx_ = None
    
    def fit(self, X, y):
        """Find lag_1 column index."""
        if hasattr(X, 'columns'):
            try:
                self.lag_col_idx_ = list(X.columns).index('lag_1')
            except ValueError:
                raise ValueError("NaiveLastValue requires 'lag_1' column in X")
        else:
            # Assume lag_1 is first column if no column names
            self.lag_col_idx_ = 0
        return self
    
    def predict(self, X):
        """Return lag_1 values as predictions."""
        if hasattr(X, 'iloc'):
            return X.iloc[:, self.lag_col_idx_].values
        return X[:, self.lag_col_idx_]


class SeasonalNaive:
    """Baseline: predict tomorrow = same day last week (lag_7)."""
    
    def __init__(self):
        self.lag_col_idx_ = None
    
    def fit(self, X, y):
        """Find lag_7 column index."""
        if hasattr(X, 'columns'):
            try:
                self.lag_col_idx_ = list(X.columns).index('lag_7')
            except ValueError:
                raise ValueError("SeasonalNaive requires 'lag_7' column in X")
        else:
            self.lag_col_idx_ = 1 if X.shape[1] > 1 else 0
        return self
    
    def predict(self, X):
        """Return lag_7 values as predictions."""
        if hasattr(X, 'iloc'):
            return X.iloc[:, self.lag_col_idx_].values
        return X[:, self.lag_col_idx_]


class MovingAverage:
    """Baseline: predict tomorrow = rolling_mean_7."""
    
    def __init__(self):
        self.col_idx_ = None
    
    def fit(self, X, y):
        """Find rolling_mean_7 column index."""
        if hasattr(X, 'columns'):
            try:
                self.col_idx_ = list(X.columns).index('rolling_mean_7')
            except ValueError:
                raise ValueError("MovingAverage requires 'rolling_mean_7' column in X")
        else:
            self.col_idx_ = 2 if X.shape[1] > 2 else 0
        return self
    
    def predict(self, X):
        """Return rolling mean values as predictions."""
        if hasattr(X, 'iloc'):
            return X.iloc[:, self.col_idx_].values
        return X[:, self.col_idx_]


def get_baseline_models() -> dict[str, ForecastModel]:
    """Return dictionary of baseline models."""
    return {
        "naive_last": NaiveLastValue(),
        "seasonal_naive": SeasonalNaive(),
        "moving_avg": MovingAverage(),
    }


def get_tree_model() -> HistGradientBoostingRegressor:
    """Return configured gradient boosting model.
    
    HistGradientBoostingRegressor is fast, handles missing values,
    and works well for time series without GPU requirements.
    """
    return HistGradientBoostingRegressor(
        max_iter=100,
        max_depth=5,
        learning_rate=0.1,
        min_samples_leaf=20,
        random_state=42,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=10,
        verbose=0
    )


def get_all_models() -> dict[str, ForecastModel]:
    """Return all models (baselines + tree)."""
    models = get_baseline_models()
    models["gradient_boost"] = get_tree_model()
    return models
