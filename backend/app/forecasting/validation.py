"""
Time-based train/test split and evaluation metrics.

Critical: No random shuffling - time series must maintain temporal order.
"""
from typing import Tuple
import numpy as np
import pandas as pd


def time_based_split(
    df: pd.DataFrame,
    group_cols: list[str],
    date_col: str = "date",
    train_ratio: float = 0.8,
    min_rows: int = 30
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Split each time series into train/test by time.
    
    For each (bank_id, item_id[, location_id]) group:
    - Sort by date
    - Take first 80% as train, last 20% as test
    - Skip series with fewer than min_rows
    
    Args:
        df: Full dataset with group_cols + date_col
        group_cols: Columns defining each series (e.g., ["bank_id", "item_id"])
        date_col: Date column name
        train_ratio: Fraction of data for training (0.0-1.0)
        min_rows: Minimum rows required per series (default: 30)
    
    Returns:
        (train_df, test_df)
    """
    train_dfs = []
    test_dfs = []
    
    for keys, group in df.groupby(group_cols, dropna=False):
        group = group.sort_values(date_col)
        n = len(group)
        
        # Skip series with too few rows
        if n < min_rows:
            continue
        
        split_idx = int(n * train_ratio)
        
        if split_idx < 1:
            # Series too short after split, put in train only
            train_dfs.append(group)
            continue
        
        train_dfs.append(group.iloc[:split_idx])
        test_dfs.append(group.iloc[split_idx:])
    
    train_df = pd.concat(train_dfs, ignore_index=True) if train_dfs else pd.DataFrame()
    test_df = pd.concat(test_dfs, ignore_index=True) if test_dfs else pd.DataFrame()
    
    return train_df, test_df


def split_train_test_per_series(
    df: pd.DataFrame,
    series_keys: list[str],
    time_col: str = "date",
    train_frac: float = 0.8,
    min_rows: int = 30
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Split each time series into train/test by time (wrapper for time_based_split).
    
    For each series defined by series_keys:
    - Sort by time_col
    - Train = earliest train_frac (default 80%)
    - Test = last (1 - train_frac) (default 20%)
    - Skip series with fewer than min_rows (default 30)
    
    Args:
        df: Full dataset
        series_keys: Columns defining each series (e.g., ["bank_id", "item_id"])
        time_col: Time column name (default: "date")
        train_frac: Fraction for training (default: 0.8)
        min_rows: Minimum rows per series (default: 30)
    
    Returns:
        (train_df, test_df)
    """
    return time_based_split(
        df=df,
        group_cols=series_keys,
        date_col=time_col,
        train_ratio=train_frac,
        min_rows=min_rows
    )


def mean_absolute_error(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Compute MAE."""
    return np.mean(np.abs(y_true - y_pred))


def weighted_absolute_percentage_error(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    Compute WAPE (Weighted Absolute Percentage Error).
    
    WAPE = sum(|y_true - y_pred|) / sum(|y_true|)
    
    More robust than MAPE when y_true contains zeros.
    Returns value in range [0, inf), interpret as percentage (multiply by 100).
    """
    numerator = np.sum(np.abs(y_true - y_pred))
    denominator = np.sum(np.abs(y_true))
    
    if denominator == 0:
        return np.nan
    
    return numerator / denominator


def bias(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    Compute bias (mean error).
    
    Bias = mean(y_pred - y_true)
    
    Positive = over-forecasting, Negative = under-forecasting
    """
    return np.mean(y_pred - y_true)


def forecast_bias(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    Compute forecast bias as specified: sum(yhat - y) / sum(y).
    
    Bias interpretation:
    - Positive: over-forecast (predictions too high)
    - Negative: under-forecast (predictions too low)
    - 0.0: unbiased
    
    Args:
        y_true: Actual values
        y_pred: Predicted values
    
    Returns:
        Bias value, or NaN if sum(y_true) is zero
    """
    sum_y = np.sum(y_true)
    if sum_y == 0 or len(y_true) == 0:
        return np.nan
    return float(np.sum(y_pred - y_true) / sum_y)


def evaluate_predictions(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """
    Evaluate predictions with standard metrics.
    
    Returns dict with:
    - mae: Mean Absolute Error
    - wape: Weighted Absolute Percentage Error
    - bias: Forecast bias (sum(yhat-y) / sum(y))
    
    Args:
        y_true: Actual values
        y_pred: Predicted values
    
    Returns:
        Dictionary with metric names and values
    """
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "wape": float(weighted_absolute_percentage_error(y_true, y_pred)),
        "bias": float(forecast_bias(y_true, y_pred))
    }


def evaluate_across_series(
    df: pd.DataFrame,
    y_col: str,
    yhat_col: str,
    series_keys: list[str]
) -> dict:
    """
    Compute global metrics across all series.
    
    Aggregates all predictions and actuals first, then computes metrics once.
    
    Args:
        df: DataFrame with predictions and actuals
        y_col: Column name for actual values
        yhat_col: Column name for predicted values
        series_keys: Columns defining series (e.g., ["bank_id", "item_id"])
    
    Returns:
        Dictionary with mae, wape, bias computed globally
    """
    if df.empty or y_col not in df.columns or yhat_col not in df.columns:
        return {"mae": np.nan, "wape": np.nan, "bias": np.nan}
    
    y_true = df[y_col].values
    y_pred = df[yhat_col].values
    
    return evaluate_predictions(y_true, y_pred)


def evaluate_model(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """
    Compute all metrics for a single model's predictions.
    
    Args:
        y_true: Actual values
        y_pred: Predicted values
    
    Returns:
        Dictionary with MAE, WAPE, Bias
    """
    return {
        "mae": mean_absolute_error(y_true, y_pred),
        "wape": weighted_absolute_percentage_error(y_true, y_pred),
        "bias": bias(y_true, y_pred),
    }


def evaluate_all_models(
    y_true: np.ndarray,
    predictions: dict[str, np.ndarray]
) -> pd.DataFrame:
    """
    Evaluate multiple models and return comparison table.
    
    Args:
        y_true: Actual values
        predictions: Dict of {model_name: y_pred}
    
    Returns:
        DataFrame with columns: model, mae, wape, bias
    """
    results = []
    
    for model_name, y_pred in predictions.items():
        metrics = evaluate_predictions(y_true, y_pred)
        results.append({
            "model": model_name,
            **metrics
        })
    
    return pd.DataFrame(results).sort_values("mae")
