from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, List, Literal
from pathlib import Path

import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session

@dataclass
class DemandForecast:
    """
    - group_by_location=False => bank_id + item_id + date
    - group_by_location=True  => bank_id + location_id + item_id + date

    location_source:
      - "movement": uses inventory_movement.from_location_id (location where item moved from)
      - "inventory": uses inventory.location_id (current item location)
    """
    group_by_location: bool = False
    location_source: Literal["movement", "inventory"] = "movement"

def _fill_missing_dates(
    df: pd.DataFrame,
    group_cols: List[str],
    date_col: str = "date",
    value_col: str = "demand_qty",
) -> pd.DataFrame:
    """Fill missing daily dates with 0 demand for each series."""
    if df.empty:
        return df
    
    df[date_col] = pd.to_datetime(df[date_col]).dt.date
    out = []
    
    for keys, g in df.groupby(group_cols, dropna=False):
        g = g.sort_values(date_col)
        min_d = pd.to_datetime(g[date_col].min())
        max_d = pd.to_datetime(g[date_col].max())
        full_dates = pd.date_range(start=min_d, end=max_d, freq='D').date
        
        base = pd.DataFrame({date_col: full_dates})
        
        if not isinstance(keys, tuple):
            keys = (keys,)
        for col, val in zip(group_cols, keys):
            base[col] = val
        
        merged = base.merge(g, on=group_cols + [date_col], how='left')
        merged[value_col] = merged[value_col].fillna(0).astype(int)
        out.append(merged)
    
    return pd.concat(out, ignore_index=True)

def extract_demand_forecast_data(
    db: Session,
    config: DemandForecast = DemandForecast(),
    bank_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> pd.DataFrame:
    """Builds daily demand series from CSV file
    
    CSV source: data/forecasting/donations_timeseries.csv
    CSV columns: date, bank_id, item_id, demand_qty
    
    Returns:
      Bank-level:    bank_id, item_id, date, demand_qty
      Location-level: bank_id, location_id, item_id, date, demand_qty
      
    Note: When group_by_location=True, adds location_id with constant value (1)
          to maintain consistent API with database version.
    """
    
    # Read CSV from data/forecasting/donations_timeseries.csv
    csv_path = Path(__file__).parent.parent.parent.parent / "data" / "forecasting" / "donations_timeseries.csv"
    df = pd.read_csv(csv_path)
    
    # Parse date column
    df["date"] = pd.to_datetime(df["date"]).dt.date
    
    # Apply filters
    if bank_id is not None:
        df = df[df["bank_id"] == bank_id]
    if start_date is not None:
        start = pd.to_datetime(start_date).date()
        df = df[df["date"] >= start]
    if end_date is not None:
        end = pd.to_datetime(end_date).date()
        df = df[df["date"] <= end]
    
    # If group_by_location=True, add constant location_id column
    # (treating each food bank as single location for now)
    if config.group_by_location:
        df["location_id"] = 1
    
    # Ensure demand_qty is integer
    df["demand_qty"] = df["demand_qty"].astype(int)
    
    # Select and order columns
    group_cols = ["bank_id", "item_id"]
    if config.group_by_location:
        group_cols = ["bank_id", "location_id", "item_id"]
    
    output_cols = group_cols + ["date", "demand_qty"]
    df = df[output_cols]

    # Fill missing dates with zeros so you have a true time series
    return _fill_missing_dates(df, group_cols=group_cols)