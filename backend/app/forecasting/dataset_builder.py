import pandas as pd
from sqlalchemy.orm import Session

from app.forecasting.data_extractions import extract_demand_forecast_data, DemandForecast
from app.forecasting.feature_engineering import (
    add_calendar_features,
    add_lag_features,
    add_rolling_features,
)

def build_training_dataset(
    db: Session,
    group_by_location: bool = False,
) -> pd.DataFrame:
    """Builds a training dataset with features for demand forecasting.
    
    Target: next-day demand (demand_qty shifted -1 day)
    Features: lag_1, lag_7, rolling_mean_7, day_of_week, is_weekend, month
    
    Returns:
        DataFrame with columns:
            - group_cols (bank_id, item_id[, location_id])
            - date
            - demand_qty (same-day actual, for reference)
            - target (next-day demand to predict)
            - feature columns
    """
    # 1) Pull base time series
    time_series = extract_demand_forecast_data(
        db=db,
        config=DemandForecast(group_by_location=group_by_location)
    )
    df = time_series.copy()

    group_cols = ["bank_id", "item_id"]
    if group_by_location:
        group_cols = ["bank_id", "location_id", "item_id"]
    
    # 2) Feature engineering
    df = add_calendar_features(df)
    df = add_lag_features(df, group_cols=group_cols, lags=[1,7])
    df = add_rolling_features(df, group_cols=group_cols, windows=[7])
    
    # 3) Create next-day target
    # Sort to ensure proper shifting
    df = df.sort_values(group_cols + ["date"])
    df["target"] = df.groupby(group_cols)["demand_qty"].shift(-1)
    
    # 4) Drop rows where features or target aren't defined
    # - First 7 days: no lag_7 / rolling_mean_7
    # - Last day: no target (can't predict beyond available data)
    required = ["lag_1", "lag_7", "rolling_mean_7", "target"]
    df = df.dropna(subset=required).reset_index(drop=True)

    return df