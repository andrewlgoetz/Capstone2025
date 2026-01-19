# Demand Forecasting - Training Guide

## Quick Start

```bash
# 1. Start database
docker-compose up -d

# 2. Run migrations
alembic upgrade head

# 3. Seed initial data (food banks, locations, inventory items)
python seed_db.py

# 4. Train models with auto-seed
python -m app.forecasting.train --auto-seed --seed-days 180
```

## Prerequisites

### System Requirements
- **Python**: 3.9+
- **Docker**: For PostgreSQL database
- **RAM**: 4GB minimum (8GB recommended for large datasets)

### Python Dependencies
```bash
pip install -r requirements.txt
```

Key packages:
- `pandas` - Data manipulation
- `numpy` - Numerical operations
- `scikit-learn` - Machine learning models
- `joblib` - Model serialization
- `sqlalchemy` - Database ORM
- `psycopg2-binary` - PostgreSQL adapter
- `alembic` - Database migrations

### Database Setup
1. **Start PostgreSQL**:
   ```bash
   docker-compose up -d
   ```

2. **Run migrations** (creates tables):
   ```bash
   cd backend
   alembic upgrade head
   ```

3. **Seed base data** (food banks, locations, inventory items):
   ```bash
   python seed_db.py
   ```

## Training Pipeline

### Option 1: Automatic (Recommended for First Run)
Let the pipeline seed synthetic demand data automatically if insufficient:

```bash
python -m app.forecasting.train --auto-seed --seed-days 180
```

### Option 2: Manual Seeding
Seed demand data first, then train:

```bash
# Seed 180 days of synthetic OUTBOUND movements
python -m app.forecasting.seed_outbound_movements --days 180

# Train models
python -m app.forecasting.train
```

### CLI Options

```bash
python -m app.forecasting.train \
  --bank-id 1                    # Optional: train for specific bank
  --group-by-location            # Optional: separate models per location
  --auto-seed                    # Auto-generate data if insufficient
  --seed-days 180                # Days to seed (default: 180)
  --min-train-rows 5000          # Minimum rows required (default: 5000)
  --min-series-rows 30           # Min rows per series for split (default: 30)
  --output-dir ./my_models       # Custom output directory
```

## What Happens During Training

### 1. Data Extraction
- Pulls OUTBOUND movements from `inventory_movement` table
- Joins with inventory items to get bank/location info
- Aggregates daily demand quantities

### 2. Feature Engineering
Creates features for each time series:
- **lag_1**: Previous day's demand
- **lag_7**: Demand 7 days ago
- **rolling_mean_7**: 7-day moving average
- **day_of_week**: 0 (Monday) to 6 (Sunday)
- **is_weekend**: Binary flag
- **month**: 1-12

### 3. Target Creation
- **Next-day prediction**: `target = demand_qty.shift(-1)`
- Rows with missing targets are dropped

### 4. Train/Test Split
- **Time-based 80/20 split** (preserves temporal order)
- Each series must have ≥30 rows to be included
- Train on first 80% of each series, test on last 20%

### 5. Model Training
Four models trained in parallel:

| Model | Description | Use Case |
|-------|-------------|----------|
| `naive_last` | Uses previous day's value | Baseline |
| `seasonal_naive` | Uses value from 7 days ago | Weekly patterns |
| `moving_avg` | 7-day moving average | Smoothing |
| `gradient_boost` | HistGradientBoostingRegressor | Best accuracy |

### 6. Evaluation Metrics
- **MAE** (Mean Absolute Error): Average prediction error in items
- **WAPE** (Weighted Absolute % Error): `sum(|pred-actual|) / sum(actual)`
- **Bias**: `sum(pred-actual) / sum(actual)` - detects systematic over/under forecasting

### 7. Artifact Storage
Results saved to `artifacts/<timestamp>/`:
```
artifacts/20260119_163142/
├── model.joblib              # Best trained model
├── metrics.json              # All model performance metrics
├── config.json               # Training configuration
├── dataset_summary.csv       # Per-series statistics
└── features_preview.csv      # First 200 rows of features
```

## Output Interpretation

### Successful Training Output
```
============================================================
DEMAND FORECASTING TRAINING PIPELINE
============================================================

[1/6] Building dataset...
  ✓ Dataset shape: (8559, 11)
  ✓ Date range: 2025-07-30 to 2026-01-17
  ✓ Time series: 50

[2/6] Splitting train/test (80/20 time-based)...
  ✓ Train: 6822 rows
  ✓ Test: 1737 rows

[3/6] Training models...
  • naive_last... ✓
  • seasonal_naive... ✓
  • moving_avg... ✓
  • gradient_boost... ✓

[4/6] Evaluating...

         model      mae     wape      bias
gradient_boost 2.032820 0.780161 -0.001909
    moving_avg 2.329797 0.894135 -0.010290
seasonal_naive 2.873345 1.102740 -0.009059
    naive_last 3.015544 1.157313 -0.010605

[5/6] Saving artifacts to artifacts/20260119_163142/...

[6/6] Training Summary
============================================================
🏆 Best model: gradient_boost
   • MAE:  2.03 items
   • WAPE: 78.02%
   • Bias: -0.0019
============================================================
```

### Understanding Metrics
- **Lower MAE is better**: Average error per prediction
- **Lower WAPE is better**: Weighted percentage error (< 100% = good)
- **Bias near 0 is best**: Negative = slight under-forecasting, Positive = over-forecasting

## Troubleshooting

### Error: "Dataset insufficient"
**Problem**: Not enough historical data to train

**Solution**:
```bash
# Use auto-seed
python -m app.forecasting.train --auto-seed --seed-days 365

# Or manually seed more days
python -m app.forecasting.seed_outbound_movements --days 365
```

### Error: "relation 'inventory_movement' does not exist"
**Problem**: Database tables not created

**Solution**:
```bash
cd backend
alembic upgrade head
```

### Error: "No inventory items found"
**Problem**: Base inventory data not seeded

**Solution**:
```bash
python seed_db.py
```

### Error: "Cannot connect to Docker daemon"
**Problem**: Docker not running

**Solution**:
```bash
# Start Docker Desktop, then:
docker-compose up -d
```

### Poor Model Performance (WAPE > 150%)
**Possible causes**:
1. **Insufficient data**: Need more historical days
2. **High variability**: Real demand has large fluctuations
3. **Cold start**: New items without history

**Solutions**:
- Seed more days: `--seed-days 365`
- Lower minimum rows: `--min-train-rows 3000`
- Check `dataset_summary.csv` for per-series stats

## Advanced Usage

### Training for Specific Bank
```bash
python -m app.forecasting.train --bank-id 1 --auto-seed
```

### Location-Specific Models
Train separate models for each location:
```bash
python -m app.forecasting.train --group-by-location --auto-seed
```

### Custom Output Directory
```bash
python -m app.forecasting.train --output-dir ./production_models --auto-seed
```

### Programmatic Usage
```python
from app.forecasting.train import train_and_evaluate

results = train_and_evaluate(
    bank_id=None,
    group_by_location=False,
    output_dir="artifacts",
    auto_seed=True,
    seed_days=180,
    min_train_rows=5000,
    min_series_rows=30
)

print(f"Best model: {results['best_model']}")
print(f"MAE: {results['best_mae']:.2f}")
```

## Next Steps

After training:

1. **Review metrics** in `artifacts/<timestamp>/metrics.json`
2. **Inspect data** in `features_preview.csv` and `dataset_summary.csv`
3. **Use model for predictions**:
   ```python
   from app.forecasting.prediction import forecast
   
   result = forecast(
       bank_id=1,
       item_id=123,
       location_id=456,
       horizon=7,  # days to forecast
       history_days=60,
       model_path="artifacts/20260119_163142/model.joblib"
   )
   ```

## Production Checklist

Before deploying:

- [ ] Database properly seeded with real inventory items
- [ ] At least 6 months of real OUTBOUND movement history
- [ ] Training achieves MAE < 5 items and WAPE < 100%
- [ ] Model artifacts backed up securely
- [ ] Retrain weekly/monthly to capture new patterns
- [ ] Monitor prediction accuracy in production
- [ ] Set up alerting for model drift (bias > 10%)

## Support

For issues or questions:
1. Check the main [README.md](./README.md) for architecture details
2. Review code comments in `train.py`
3. Run debug validation: `python -m app.forecasting.debug_dataset`
