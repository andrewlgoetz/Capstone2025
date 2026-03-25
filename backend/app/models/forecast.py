"""
SQLAlchemy ORM models for the demand forecasting pipeline.

Two tables:

  ForecastRun   — one row per pipeline execution per food bank.
                  Stores metadata, training window, aggregate backtest
                  metrics, and a per-category JSONB params blob.

  ForecastValue — one row per (run × entity × week).
                  Stores BOTH historical actuals (is_historical=True) and
                  future predictions (is_historical=False) so the frontend
                  can render a single continuous line in one query.

run_id is a VARCHAR(36) UUID string generated in Python via str(uuid.uuid4()).
The server-side default (gen_random_uuid()::text) is a fallback; the
application always supplies the value so run_id is known before the INSERT.
"""

import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.db.session import Base


class ForecastRun(Base):
    __tablename__ = "forecast_runs"

    # UUID stored as a plain string so no dialect-specific type is needed on
    # read paths.  Generated in Python; server default is a safety net only.
    run_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        nullable=False,
    )
    bank_id = Column(
        Integer,
        ForeignKey("food_banks.bank_id"),
        nullable=False,
        index=True,
    )
    run_timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    # Primary model(s) used: 'ETS', 'Croston', 'NaiveMean', 'ETS/Croston', 'PENDING'
    model_type = Column(String(64), nullable=False)
    # Always 'category_week' in v1; 'item_week' in future
    granularity = Column(String(32), nullable=False)
    # Always 'all' in v1; per-location scope in future
    location_scope = Column(String(32), nullable=False, default="all")
    # Number of weeks of OUTBOUND history used for training
    weeks_of_history = Column(Integer, nullable=False)
    # Horizon used when this run was generated
    weeks_ahead = Column(Integer, nullable=False)
    # Per-category model params + data_status, stored as JSONB.
    # Schema: { "<category>": { "model_type": "ETS", "data_status": "adequate",
    #                           "params": { ... } }, ... }
    model_params = Column(JSONB, nullable=True)
    # Aggregate backtest metrics (mean across categories with adequate data)
    backtest_wape = Column(Numeric(8, 4), nullable=True)
    backtest_mase = Column(Numeric(8, 4), nullable=True)
    backtest_mae = Column(Numeric(8, 4), nullable=True)
    # Date range of training data
    training_start = Column(Date, nullable=False)
    training_end = Column(Date, nullable=False)
    # Lifecycle: 'running' → 'completed' | 'failed'
    status = Column(String(32), nullable=False, default="completed")
    error_message = Column(Text, nullable=True)
    # NULL for background auto-runs; set when triggered by a user via the API
    created_by = Column(
        Integer,
        ForeignKey("users.user_id"),
        nullable=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class ForecastValue(Base):
    __tablename__ = "forecast_values"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    run_id = Column(
        String(36),
        ForeignKey("forecast_runs.run_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bank_id = Column(
        Integer,
        ForeignKey("food_banks.bank_id"),
        nullable=False,
        index=True,
    )
    # 'category' in v1; 'item' in future
    entity_type = Column(String(16), nullable=False)
    # FK to categories.category_id; nullable because inventory.category is
    # free-text and may not resolve to a category_id row
    entity_id = Column(Integer, nullable=True)
    # Canonical category name (denormalised for query convenience)
    entity_name = Column(String(256), nullable=False)
    # ISO week start date (always a Monday)
    week_start = Column(Date, nullable=False)
    # True  → actual historical outflow (point_forecast holds the real value)
    # False → model prediction
    is_historical = Column(Boolean, nullable=False, default=False)
    # Holds the actual quantity when is_historical=True, forecast otherwise
    point_forecast = Column(Numeric(12, 2), nullable=False)
    # 80 % prediction interval bounds (NULL for historical rows and Croston v1)
    ci_lower_80 = Column(Numeric(12, 2), nullable=True)
    ci_upper_80 = Column(Numeric(12, 2), nullable=True)
    # 95 % prediction interval bounds
    ci_lower_95 = Column(Numeric(12, 2), nullable=True)
    ci_upper_95 = Column(Numeric(12, 2), nullable=True)
    # Steps ahead from training_end; NULL for historical rows
    horizon_weeks = Column(Integer, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
