import pandas as pd

def ensure_datetime(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure all date columns are in datetime format."""
    df.copy()
    df["date"] = pd.to_datetime(df["date"])
    return df

def add_calendar_features(df: pd.DataFrame) -> pd.DataFrame:
    df = ensure_datetime(df)
    df["day_of_week"] = df["date"].dt.weekday  # 0 = Monday, 6 = Sunday
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
    df["month"] = df["date"].dt.month
    return df

def add_lag_features(
    df: pd.DataFrame,
    group_cols: list[str],
    target_col: str = "demand_qty",
    lags: list[int] = [1,7],
) -> pd.DataFrame:
    df = ensure_datetime(df)
    df = df.sort_values(group_cols + ["date"])
    for lag in lags:
        df[f"lag_{lag}"] = df.groupby(group_cols)[target_col].shift(lag)
    return df

def add_rolling_features(
    df: pd.DataFrame,
    group_cols: list[str],
    target_col: str = "demand_qty",
    windows: list[int] = [7],
) -> pd.DataFrame:
    df = ensure_datetime(df)
    df = df.sort_values(group_cols + ["date"])
    
    # shift(1) prevents leaking "today's" demand into today's features
    shifted = df.groupby(group_cols)[target_col].shift(1)
    
    for w in windows:
        df[f"rolling_mean_{w}"] = (
            shifted.groupby([df[c] for c in group_cols])
                   .rolling(w)
                   .mean()
                   .reset_index(level=list(range(len(group_cols))), drop=True)
        )

    return df