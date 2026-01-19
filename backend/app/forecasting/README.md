# Demand Forecasting Pipeline

Time-series forecasting for food bank inventory demand using historical OUTBOUND movement data.

## Quick Start

### 1. Seed Historical Data (first time only)

```bash
cd backend
source venv/bin/activate
python -m app.forecasting.seed_outbound_movements --days 180 --bank-id 1
```

**Options:**
- `--days`: Number of days of history to generate (default: 180)
- `--bank-id`: Filter to specific bank (optional)
- `--group-by-location`: Seed per location (optional)
- `--prob`: Daily movement probability 0.0-1.0 (default: 0.7)
- `--force`: Skip insufficiency check and seed anyway
- `--check-only`: Only check if seeding needed, don't seed

### 2. Train Models

```bash
python -m app.forecasting.train --bank-id 1
```

**Outputs** (saved to `artifacts/`):
- `model_*.joblib` - Trained best model
- `metrics_*.json` - Performance metrics (MAE, WAPE, Bias)
- `dataset_summary_*.csv` - Dataset statistics per series

**Options:**
- `--bank-id`: Filter to specific bank (optional)
- `--group-by-location`: Train per location instead of bank-level
- `--output-dir`: Artifact directory (default: `artifacts`)

### 3. Generate Forecasts

```bash
python -m app.forecasting.prediction --bank-id 1 --item-id 5 --horizon 7
```

**Options:**
- `--bank-id`: Bank ID (required)
- `--item-id`: Item ID filter (optional, predicts all if omitted)
- `--location-id`: Location ID filter (optional)
- `--horizon`: Days to forecast (default: 7)
- `--artifacts-dir`: Where to load model from (default: `artifacts`)
- `--output`: Save forecasts to CSV (optional)

---

## Architecture

### Data Flow

```
inventory_movement (DB)
  ↓ extract_demand_forecast_data()
Daily demand time series
  ↓ feature_engineering
Features: lag_1, lag_7, rolling_mean_7, calendar
  ↓ dataset_builder
Training dataset (X, y=next-day demand)
  ↓ time_based_split (80/20)
Train/Test
  ↓ models
Baseline + HistGradientBoosting
  ↓ validation
MAE, WAPE, Bias metrics
  ↓ prediction
Recursive 7-day forecasts
```

### Key Design Principles

1. **Time Granularity**: Daily aggregation
2. **Target**: Next-day demand (`target = demand_qty.shift(-1)`)
3. **Features**:
   - Lag features: `lag_1`, `lag_7`
   - Rolling stats: `rolling_mean_7`
   - Calendar: `day_of_week`, `is_weekend`, `month`
4. **No Data Leakage**: Time-based 80/20 split, never random shuffle
5. **No GPU Required**: CPU-only sklearn models
6. **Lightweight**: pandas/numpy/sklearn only

---

## Models

### Baselines
- **NaiveLastValue**: Tomorrow = today (`lag_1`)
- **SeasonalNaive**: Tomorrow = same day last week (`lag_7`)
- **MovingAverage**: Tomorrow = 7-day rolling mean

### ML Model
- **HistGradientBoostingRegressor**: Fast, handles missing values, no GPU needed
  - `max_iter=100`, `max_depth=5`, early stopping enabled

---

## Metrics

- **MAE** (Mean Absolute Error): Average prediction error in units
- **WAPE** (Weighted Absolute Percentage Error): `sum(|error|) / sum(|actual|)` - robust to zeros
- **Bias**: `mean(pred - actual)` - detects systematic over/under-forecasting

---

## File Structure

```
backend/app/forecasting/
├── __init__.py                   # Module marker
├── data_extractions.py           # Query OUTBOUND movements → time series
├── feature_engineering.py        # Add lag/rolling/calendar features
├── dataset_builder.py            # Build training dataset (X, y)
├── models.py                     # Baseline + tree models
├── validation.py                 # Time-based split + metrics
├── train.py                      # End-to-end training pipeline
├── prediction.py                 # Recursive forecasting
├── seed_outbound_movements.py    # Generate synthetic history
├── debug.py                      # Debug data extraction
└── debug_dataset.py              # Debug dataset builder
```

---

## Troubleshooting

### "Dataset is empty"
**Cause**: No OUTBOUND movements in database.

**Fix**:
```bash
python -m app.forecasting.seed_outbound_movements --days 180 --bank-id 1
```

### "Test set is empty"
**Cause**: Time series too short (< 30 days per item).

**Fix**: Seed more days or reduce `train_ratio` in `validation.py`.

### "ModuleNotFoundError: No module named 'dotenv'"
**Cause**: Missing dependencies.

**Fix**:
```bash
pip install python-dotenv
```

### Poor Forecast Accuracy
**Causes**:
- Not enough historical data (need 60+ days)
- High demand variability
- Seasonality not captured by weekly lag

**Fixes**:
- Seed more realistic patterns (adjust `per_item_daily_prob`)
- Add more lag features (lag_14, lag_30)
- Try different models (XGBoost, Prophet)

---

## Next Steps

1. **API Integration**: Add FastAPI endpoint to serve forecasts
2. **Frontend**: Visualize forecasts in `DemandLineChart.jsx`
3. **Advanced Features**:
   - External factors (holidays, weather, events)
   - Multi-step forecasting (predict full week at once)
   - Probabilistic forecasts (prediction intervals)
4. **Model Registry**: Track model versions and A/B test
5. **Monitoring**: Track forecast accuracy over time, retrain when drift detected

---

## Example Session

```bash
# 1. Check if seeding needed
python -m app.forecasting.seed_outbound_movements --check-only

# 2. Seed 6 months of history
python -m app.forecasting.seed_outbound_movements --days 180 --bank-id 1

# 3. Train models
python -m app.forecasting.train --bank-id 1

# Output:
# ============================================================
# DEMAND FORECASTING TRAINING PIPELINE
# ============================================================
# [1/5] Building dataset...
#   ✓ Dataset shape: (1423, 13)
#   ✓ Date range: 2025-07-23 to 2026-01-18
#   ✓ Time series: 12
# [2/5] Splitting train/test (80/20 time-based)...
#   ✓ Train: 1138 rows
#   ✓ Test: 285 rows
# [3/5] Training models...
#   • naive_last... ✓
#   • seasonal_naive... ✓
#   • moving_avg... ✓
#   • gradient_boost... ✓
# [4/5] Evaluating...
#           model       mae      wape      bias
#  gradient_boost  1.234567  0.123456  0.012345
#      naive_last  1.456789  0.145678 -0.023456
#  seasonal_naive  1.567890  0.156789  0.034567
#      moving_avg  1.678901  0.167890 -0.045678
# [5/5] Saving artifacts to artifacts/...
#   ✓ Model: artifacts/model_gradient_boost_20260119_120000.joblib
#   ✓ Metrics: artifacts/metrics_20260119_120000.json
#   ✓ Summary: artifacts/dataset_summary_20260119_120000.csv
# ============================================================
# ✅ Training complete! Best model: gradient_boost
#    MAE: 1.23
#    WAPE: 12.35%
# ============================================================

# 4. Generate forecasts
python -m app.forecasting.prediction --bank-id 1 --item-id 5 --horizon 7 --output forecasts.csv

# Output:
# 📊 Forecasting 7 days ahead...
#    Bank: 1, Item: 5, Location: all
#    Series: 1
#    ✓ Generated 7 forecasts
# ============================================================
# FORECASTS
# ============================================================
#  bank_id  item_id        date  forecast
#        1        5  2026-01-20      3.45
#        1        5  2026-01-21      3.12
#        1        5  2026-01-22      2.89
#        1        5  2026-01-23      3.67
#        1        5  2026-01-24      4.23
#        1        5  2026-01-25      4.56
#        1        5  2026-01-26      3.91
# ✓ Saved to forecasts.csv
```
