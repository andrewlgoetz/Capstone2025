"""create_forecast_tables_missing

The forecast_runs and forecast_values tables were never created because the
original migration d8e9f0a1b2c3 was shadowed by an empty stub file that ran
as a no-op. This migration creates those tables now.

Revision ID: 0ef06006e1be
Revises: i9j0k1l2m3n4
Create Date: 2026-03-25 17:40:02.184448

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '0ef06006e1be'
down_revision: Union[str, Sequence[str], None] = 'i9j0k1l2m3n4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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
        sa.Column('model_type', sa.String(64), nullable=False),
        sa.Column('granularity', sa.String(32), nullable=False),
        sa.Column('location_scope', sa.String(32), nullable=False, server_default='all'),
        sa.Column('weeks_of_history', sa.Integer(), nullable=False),
        sa.Column('weeks_ahead', sa.Integer(), nullable=False),
        sa.Column('model_params', postgresql.JSONB(), nullable=True),
        sa.Column('backtest_wape', sa.Numeric(8, 4), nullable=True),
        sa.Column('backtest_mase', sa.Numeric(8, 4), nullable=True),
        sa.Column('backtest_mae', sa.Numeric(8, 4), nullable=True),
        sa.Column('training_start', sa.Date(), nullable=False),
        sa.Column('training_end', sa.Date(), nullable=False),
        sa.Column('status', sa.String(32), nullable=False, server_default='completed'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
    )
    op.create_index('ix_forecast_runs_bank_id_ts', 'forecast_runs', ['bank_id', 'run_timestamp'])

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
        sa.Column('entity_type', sa.String(16), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('entity_name', sa.String(256), nullable=False),
        sa.Column('week_start', sa.Date(), nullable=False),
        sa.Column('is_historical', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('point_forecast', sa.Numeric(12, 2), nullable=False),
        sa.Column('ci_lower_80', sa.Numeric(12, 2), nullable=True),
        sa.Column('ci_upper_80', sa.Numeric(12, 2), nullable=True),
        sa.Column('ci_lower_95', sa.Numeric(12, 2), nullable=True),
        sa.Column('ci_upper_95', sa.Numeric(12, 2), nullable=True),
        sa.Column('horizon_weeks', sa.Integer(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
    )
    op.create_index('ix_forecast_values_run_entity', 'forecast_values', ['run_id', 'entity_name', 'week_start'])
    op.create_index('ix_forecast_values_bank_entity_week', 'forecast_values', ['bank_id', 'entity_name', 'week_start'])


def downgrade() -> None:
    op.drop_index('ix_forecast_values_bank_entity_week', table_name='forecast_values')
    op.drop_index('ix_forecast_values_run_entity', table_name='forecast_values')
    op.drop_table('forecast_values')
    op.drop_index('ix_forecast_runs_bank_id_ts', table_name='forecast_runs')
    op.drop_table('forecast_runs')
