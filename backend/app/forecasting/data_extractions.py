from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, List, Literal

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
    """Builds daily demand series from Postgres
    
    Demand definition:
    - movement_type = 'OUTBOUND'
      - quantity_change < 0
      - demand_qty = SUM(ABS(quantity_change)) per day

    Returns:
      Bank-level:    bank_id, item_id, date, demand_qty
      Location-level bank_id, location_id, item_id, date, demand_qty
    """
    
    if config.group_by_location:
        if config.location_source == "movement":
            location_select = "invmov.from_location_id AS location_id"
            location_group = "invmov.from_location_id"
        else:
            location_select = "inv.location_id AS location_id"
            location_group = "inv.location_id"
    else:
        location_select = None
        location_group = None
    where = ["invmov.movement_type = 'OUTBOUND'", "invmov.quantity_change < 0"]
    params = {}
    
    if bank_id is not None:
        where.append("inv.bank_id = :bank_id")
        params["bank_id"] = bank_id
    if start_date is not None:
        where.append("invmov.created_at >= :start_date")
        params["start_date"] = start_date
    if end_date is not None:
        where.append("invmov.created_at <= :end_date")
        params["end_date"] = end_date
    
    where_sql = " AND ".join(where)
    
    sql = f"""
    SELECT
        inv.bank_id AS bank_id
        {"," if location_select else ""} {location_select or ""}
        , invmov.item_id AS item_id
        , DATE(invmov.created_at) AS date
        , SUM(ABS(invmov.quantity_change))::int AS demand_qty
        FROM inventory_movement AS invmov
        JOIN inventory AS inv ON invmov.item_id = inv.item_id
        WHERE {where_sql}
        GROUP BY
            inv.bank_id
            {"," if location_group else ""} {location_group or ""}
            , invmov.item_id
            , DATE(invmov.created_at)
        """
    df = pd.read_sql(text(sql), db.bind, params=params)

    # Fill missing dates with zeros so you have a true time series
    group_cols = ["bank_id", "item_id"]
    if config.group_by_location:
        group_cols = ["bank_id", "location_id", "item_id"]

    return _fill_missing_dates(df, group_cols=group_cols)