"""
Demand forecasting predictions using recursive daily forecasting.

Usage:
    python -m app.forecasting.prediction --bank-id 1 --item-id 5 --horizon 7
"""
import argparse
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.database import get_db
from app.forecasting.data_extractions import extract_demand_forecast_data, DemandForecast
from app.forecasting.feature_engineering import add_calendar_features


def load_latest_model(artifacts_dir: str = "artifacts"):
    """Load the most recent trained model."""
    path = Path(artifacts_dir)
    if not path.exists():
        raise FileNotFoundError(f"Artifacts directory not found: {artifacts_dir}")
    
    model_files = list(path.glob("model_*.joblib"))
    if not model_files:
        raise FileNotFoundError(
            f"No trained models found in {artifacts_dir}. "
            "Run training first: python -m app.forecasting.train"
        )
    
    # Get most recent by filename timestamp
    latest = max(model_files, key=lambda p: p.stat().st_mtime)
    print(f"Loading model: {latest.name}")
    return joblib.load(latest)


def get_latest_data(
    db: Session,
    bank_id: int,
    item_id: Optional[int] = None,
    location_id: Optional[int] = None,
    n_days: int = 14
) -> pd.DataFrame:
    """
    Get most recent historical data for a series.
    
    Args:
        db: Database session
        bank_id: Bank ID
        item_id: Optional item filter (None = all items)
        location_id: Optional location filter
        n_days: Number of recent days to fetch
    
    Returns:
        DataFrame with recent demand history
    """
    group_by_location = location_id is not None
    
    df = extract_demand_forecast_data(
        db=db,
        config=DemandForecast(group_by_location=group_by_location),
        bank_id=bank_id
    )
    
    if df.empty:
        raise ValueError(f"No historical data found for bank_id={bank_id}")
    
    # Filter by item/location if specified
    if item_id is not None:
        df = df[df["item_id"] == item_id]
    
    if location_id is not None and "location_id" in df.columns:
        df = df[df["location_id"] == location_id]
    
    if df.empty:
        raise ValueError(
            f"No data for bank_id={bank_id}, item_id={item_id}, location_id={location_id}"
        )
    
    # Get most recent n_days per series
    group_cols = ["bank_id", "item_id"]
    if group_by_location:
        group_cols.append("location_id")
    
    df = df.sort_values(group_cols + ["date"])
    recent = df.groupby(group_cols).tail(n_days).reset_index(drop=True)
    
    return recent


def build_forecast_features(
    history: pd.DataFrame,
    forecast_date: pd.Timestamp,
    group_cols: list[str]
) -> pd.DataFrame:
    """
    Build features for next-day forecast from historical data.
    
    Args:
        history: Recent demand history (must have at least 7 days)
        forecast_date: Date to forecast for
        group_cols: Grouping columns
    
    Returns:
        Single-row DataFrame with features for each series
    """
    features = []
    
    for keys, group in history.groupby(group_cols):
        group = group.sort_values("date")
        
        if len(group) < 7:
            continue  # Skip series without enough history
        
        # Extract recent values
        last_values = group["demand_qty"].values
        lag_1 = last_values[-1]
        lag_7 = last_values[-7] if len(last_values) >= 7 else last_values[0]
        rolling_mean_7 = np.mean(last_values[-7:])
        
        # Calendar features for forecast date
        day_of_week = forecast_date.weekday()
        is_weekend = int(day_of_week >= 5)
        month = forecast_date.month
        
        # Build feature row
        if not isinstance(keys, tuple):
            keys = (keys,)
        
        row = {col: val for col, val in zip(group_cols, keys)}
        row.update({
            "date": forecast_date,
            "lag_1": lag_1,
            "lag_7": lag_7,
            "rolling_mean_7": rolling_mean_7,
            "day_of_week": day_of_week,
            "is_weekend": is_weekend,
            "month": month,
        })
        features.append(row)
    
    return pd.DataFrame(features)


def _forecast_internal(
    model,
    db: Session,
    bank_id: int,
    item_id: Optional[int] = None,
    location_id: Optional[int] = None,
    horizon: int = 7,
    history_days: int = 14
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Internal implementation: Generate recursive daily forecasts.
    
    Args:
        model: Trained sklearn model
        db: Database session
        bank_id: Bank ID
        item_id: Optional item filter (None = all items)
        location_id: Optional location filter
        horizon: Number of days to forecast
        history_days: Number of recent days to fetch for history
    
    Returns:
        Tuple of (history_df, forecast_df)
    """
    print(f"\n📊 Forecasting {horizon} days ahead...")
    print(f"   Bank: {bank_id}, Item: {item_id or 'all'}, Location: {location_id or 'all'}")
    
    # 1. Get recent history
    history = get_latest_data(db, bank_id, item_id, location_id, n_days=history_days)
    
    group_cols = ["bank_id", "item_id"]
    if location_id is not None:
        group_cols.append("location_id")
    
    n_series = history.groupby(group_cols).ngroups
    print(f"   Series: {n_series}")
    
    # 2. Recursive forecasting
    feature_cols = ["lag_1", "lag_7", "rolling_mean_7", "day_of_week", "is_weekend", "month"]
    all_forecasts = []
    
    # Start from day after last historical date
    last_date = pd.to_datetime(history["date"].max())
    
    for day in range(1, horizon + 1):
        forecast_date = last_date + pd.Timedelta(days=day)
        
        # Build features from current history
        features_df = build_forecast_features(history, forecast_date, group_cols)
        
        if features_df.empty:
            print(f"   ⚠️  Day {day}: No valid features")
            continue
        
        # Predict
        X = features_df[feature_cols]
        predictions = model.predict(X)
        predictions = np.maximum(predictions, 0)  # Ensure non-negative
        
        # Store forecasts
        forecast_df = features_df[group_cols + ["date"]].copy()
        forecast_df["forecast"] = predictions
        all_forecasts.append(forecast_df)
        
        # Update history with predictions for next iteration
        new_rows = forecast_df.copy()
        new_rows.rename(columns={"forecast": "demand_qty"}, inplace=True)
        history = pd.concat([history, new_rows], ignore_index=True)
    
    if not all_forecasts:
        raise ValueError("Failed to generate any forecasts")
    
    result = pd.concat(all_forecasts, ignore_index=True)
    print(f"   ✓ Generated {len(result)} forecasts")
    
    return history, result


def forecast(
    bank_id: int,
    item_id: Optional[int] = None,
    location_id: Optional[int] = None,
    horizon: int = 7,
    history_days: int = 90,
    model_path: Optional[str] = None
) -> dict:
    """
    Generate recursive daily demand forecasts (spec-compliant public API).
    
    This is the public API that matches the specification exactly.
    Internal implementation is in _forecast_internal().
    
    Args:
        bank_id: Bank ID
        item_id: Optional item filter (None = all items for that bank)
        location_id: Optional location filter
        horizon: Number of days to forecast (default: 7)
        history_days: Number of recent days to use for history (default: 90)
        model_path: Path to saved model joblib file (None = load latest from artifacts)
    
    Returns:
        Dictionary with:
        - "history": DataFrame of recent historical demand (last history_days)
        - "forecast": DataFrame of predictions (next horizon days)
        - "meta": Dict with metadata (bank_id, item_id, dates, model info, etc.)
    
    Example:
        >>> result = forecast(bank_id=1, item_id=5, horizon=7, history_days=90)
        >>> print(result["forecast"])
        >>> print(result["meta"])
    """
    from datetime import datetime
    
    # 1. Load model
    if model_path:
        print(f"Loading model from: {model_path}")
        model = joblib.load(model_path)
    else:
        model = load_latest_model()
    
    # 2. Get database session
    db = next(get_db())
    
    try:
        # 3. Generate forecasts using internal implementation
        history_df, forecast_df = _forecast_internal(
            model=model,
            db=db,
            bank_id=bank_id,
            item_id=item_id,
            location_id=location_id,
            horizon=horizon,
            history_days=history_days
        )
        
        # 4. Build metadata
        meta = {
            "bank_id": bank_id,
            "item_id": item_id,
            "location_id": location_id,
            "horizon": horizon,
            "history_days": history_days,
            "model_path": model_path or "latest",
            "model_type": type(model).__name__,
            "generated_at": datetime.now().isoformat(),
            "history_date_range": {
                "start": str(history_df["date"].min()),
                "end": str(history_df["date"].max()),
                "n_rows": len(history_df)
            },
            "forecast_date_range": {
                "start": str(forecast_df["date"].min()),
                "end": str(forecast_df["date"].max()),
                "n_rows": len(forecast_df)
            }
        }
        
        # 5. Return spec-compliant dict
        return {
            "history": history_df,
            "forecast": forecast_df,
            "meta": meta
        }
    
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Generate demand forecasts")
    parser.add_argument("--bank-id", type=int, required=True, help="Bank ID")
    parser.add_argument("--item-id", type=int, default=None, help="Item ID (optional)")
    parser.add_argument("--location-id", type=int, default=None, help="Location ID (optional)")
    parser.add_argument("--horizon", type=int, default=7, help="Forecast horizon (days)")
    parser.add_argument("--artifacts-dir", default="artifacts", help="Artifacts directory")
    parser.add_argument("--output", default=None, help="Output CSV path (optional)")
    
    args = parser.parse_args()
    
    # Load model
    model = load_latest_model(args.artifacts_dir)
    
    # Generate forecasts
    db = next(get_db())
    try:
        _, forecasts = _forecast_internal(
            model=model,
            db=db,
            bank_id=args.bank_id,
            item_id=args.item_id,
            location_id=args.location_id,
            horizon=args.horizon,
            history_days=90
        )
    finally:
        db.close()
    
    # Display
    print("\n" + "=" * 60)
    print("FORECASTS")
    print("=" * 60)
    print(forecasts.to_string(index=False))
    
    # Save if requested
    if args.output:
        forecasts.to_csv(args.output, index=False)
        print(f"\n✓ Saved to {args.output}")


if __name__ == "__main__":
    main()
