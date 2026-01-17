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
    """Builds a training dataset with features for demand forecasting."""
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
    
    # 3) Drop rows where features aren't defined
    # (first 7 days of each series will not have lag_7 / rolling_mean_7)
    
    # Uncomment the following lines when we have more data
    # required = ["lag_1", "lag_7", "rolling_mean_7"]
    # df = df.dropna(subset=required).reset_index(drop=True)

    return df