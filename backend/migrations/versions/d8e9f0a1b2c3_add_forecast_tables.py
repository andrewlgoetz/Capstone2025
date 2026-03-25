"""add_forecast_tables

Creates two new tables for the demand forecasting pipeline:

  forecast_runs   — one row per pipeline execution; stores metadata,
                    aggregate backtest metrics, and per-category model params
                    as JSONB.

  forecast_values — one row per (run, entity, week); stores both historical
                    actuals (is_historical=TRUE) and future predictions
                    (is_historical=FALSE) so the frontend can render a
                    continuous line from history into forecast in a single
                    query.  ON DELETE CASCADE ensures that deleting a
                    forecast_run also removes its child values.

run_id is stored as VARCHAR(36) containing a standard UUID string.
gen_random_uuid() is used as the server-side default (available in
PostgreSQL 13+ without the pgcrypto extension).

Revision ID: d8e9f0a1b2c3
Revises: fc3a8d912b47
Create Date: 2026-03-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd8e9f0a1b2c3'
down_revision: Union[str, Sequence[str], None] = 'fc3a8d912b47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create forecast_runs and forecast_values tables."""

    # ------------------------------------------------------------------
    # forecast_runs
    # ------------------------------------------------------------------
    op.create_table(
        'forecast_runs',
        sa.Column(
            'run_id',
            sa.String(36),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()::text"),
            nullable=False,
        ),
        sa.Column('bank_id', sa.Integer(), sa.ForeignKey('food_banks.bank_id'), nullable=False),
        sa.Column(
            'run_timestamp',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        # Primary model type used; 'ETS', 'Croston', 'NaiveMean', 'ETS/Croston', 'PENDING'
        sa.Column('model_type', sa.String(64), nullable=False),
        # Forecast granularity; always 'category_week' in v1
        sa.Column('granularity', sa.String(32), nullable=False),
        # Location scope; always 'all' in v1
        sa.Column('location_scope', sa.String(32), nullable=False, server_default='all'),
        sa.Column('weeks_of_history', sa.Integer(), nullable=False),
        sa.Column('weeks_ahead', sa.Integer(), nullable=False),
        # Per-category model params stored as JSON; see pipeline.py for schema
        sa.Column('model_params', postgresql.JSONB(), nullable=True),
        # Aggregate backtest metrics (average across categories with adequate data)
        sa.Column('backtest_wape', sa.Numeric(8, 4), nullable=True),
        sa.Column('backtest_mase', sa.Numeric(8, 4), nullable=True),
        sa.Column('backtest_mae', sa.Numeric(8, 4), nullable=True),
        # Training data window
        sa.Column('training_start', sa.Date(), nullable=False),
        sa.Column('training_end', sa.Date(), nullable=False),
        # Run lifecycle: 'running' → 'completed' or 'failed'
        sa.Column('status', sa.String(32), nullable=False, server_default='completed'),
        sa.Column('error_message', sa.Text(), nullable=True),
        # Audit: which user triggered this run (NULL for background auto-runs)
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
    )
    op.create_index(
        'ix_forecast_runs_bank_id_ts',
        'forecast_runs',
        ['bank_id', 'run_timestamp'],
        unique=False,
    )

    # ------------------------------------------------------------------
    # forecast_values
    # ------------------------------------------------------------------
    op.create_table(
        'forecast_values',
        sa.Column('id', sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column(
            'run_id',
            sa.String(36),
            sa.ForeignKey('forecast_runs.run_id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('bank_id', sa.Integer(), sa.ForeignKey('food_banks.bank_id'), nullable=False),
        # Granularity discriminator; always 'category' in v1, 'item' in future
        sa.Column('entity_type', sa.String(16), nullable=False),
        # FK to categories.category_id; nullable because inventory.category is a
        # free-text string and may not map to a category_id
        sa.Column('entity_id', sa.Integer(), nullable=True),
        # Denormalised canonical category name for query convenience
        sa.Column('entity_name', sa.String(256), nullable=False),
        # ISO week start (Monday) as a DATE
        sa.Column('week_start', sa.Date(), nullable=False),
        # TRUE  = actual historical outflow (from inventory_movement)
        # FALSE = model forecast
        sa.Column('is_historical', sa.Boolean(), nullable=False, server_default='false'),
        # point_forecast holds actual quantity when is_historical=TRUE
        sa.Column('point_forecast', sa.Numeric(12, 2), nullable=False),
        # 80% prediction interval (NULL for historical rows and Croston v1)
        sa.Column('ci_lower_80', sa.Numeric(12, 2), nullable=True),
        sa.Column('ci_upper_80', sa.Numeric(12, 2), nullable=True),
        # 95% prediction interval
        sa.Column('ci_lower_95', sa.Numeric(12, 2), nullable=True),
        sa.Column('ci_upper_95', sa.Numeric(12, 2), nullable=True),
        # Steps ahead from training_end; NULL for historical rows
        sa.Column('horizon_weeks', sa.Integer(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
    )
    op.create_index(
        'ix_forecast_values_run_entity',
        'forecast_values',
        ['run_id', 'entity_name', 'week_start'],
        unique=False,
    )
    op.create_index(
        'ix_forecast_values_bank_entity_week',
        'forecast_values',
        ['bank_id', 'entity_name', 'week_start'],
        unique=False,
    )


def downgrade() -> None:
    """Drop forecast tables and the movement index."""
    op.drop_index('ix_forecast_values_bank_entity_week', table_name='forecast_values')
    op.drop_index('ix_forecast_values_run_entity', table_name='forecast_values')
    op.drop_table('forecast_values')
    op.drop_index('ix_forecast_runs_bank_id_ts', table_name='forecast_runs')
    op.drop_table('forecast_runs')
