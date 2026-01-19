"""
End-to-end training pipeline for demand forecasting.

QUICK START:
============
1. (Optional) Seed synthetic data if you don't have enough history:
   python -m app.forecasting.seed_outbound_movements --days 180

2. Train models:
   python -m app.forecasting.train --auto-seed

3. Or train without auto-seeding:
   python -m app.forecasting.train

EXAMPLES:
=========
# Basic training with auto-seed fallback (recommended for first run)
python -m app.forecasting.train --auto-seed

# Train for specific bank
python -m app.forecasting.train --bank-id 1 --auto-seed

# Train with location grouping
python -m app.forecasting.train --group-by-location --auto-seed

# Custom thresholds and seeding
python -m app.forecasting.train --auto-seed --seed-days 365 --min-train-rows 10000

# Specify output directory
python -m app.forecasting.train --output-dir ./my_models

WHAT IT DOES:
=============
1. Extracts demand history from inventory_movement table
2. Builds dataset with features (lag_1, lag_7, rolling_mean_7, calendar features)
3. Creates next-day target (demand_qty shifted by -1 day)
4. Splits data 80/20 by time (preserves temporal order)
5. Trains multiple models (baselines + gradient boosting)
6. Evaluates with MAE, WAPE, Bias metrics
7. Saves artifacts to: artifacts/<timestamp>/
   - model.joblib (best model)
   - metrics.json (all model results)
   - config.json (run configuration)
   - dataset_summary.csv (per-series stats)
   - features_preview.csv (first 200 rows)

AUTO-SEED FALLBACK:
===================
If --auto-seed is enabled and dataset is insufficient (<5000 rows):
  - Automatically generates synthetic OUTBOUND movements
  - Re-builds dataset after seeding
  - Continues with training

Without --auto-seed, you must manually seed data first:
  python -m app.forecasting.seed_outbound_movements --days 180

CLI OPTIONS:
============
  --bank-id INT              Filter to specific bank (default: all banks)
  --group-by-location        Train separate models per location
  --output-dir PATH          Output directory for artifacts (default: artifacts)
  --auto-seed                Auto-generate data if insufficient
  --seed-days INT            Days to seed if auto-seed enabled (default: 180)
  --min-train-rows INT       Minimum rows required for training (default: 5000)
  --min-series-rows INT      Minimum rows per series for train/test split (default: 30)

STABLE API (for imports):
==========================
Function: train_and_evaluate(bank_id, group_by_location, output_dir, auto_seed, 
                              seed_days, min_train_rows, min_series_rows)
Returns: dict with training results and metrics
"""
import argparse
import json
from pathlib import Path
from datetime import datetime

import joblib
import pandas as pd

from app.database import get_db
from app.forecasting.dataset_builder import build_training_dataset
from app.forecasting.models import get_all_models
from app.forecasting.validation import time_based_split, evaluate_all_models
from app.forecasting.seed_outbound_movements import seed_outbound_history


# Feature columns expected by models
FEATURE_COLS = ["lag_1", "lag_7", "rolling_mean_7", "day_of_week", "is_weekend", "month"]


def train_and_evaluate(
    bank_id: int = None,
    group_by_location: bool = False,
    output_dir: str = "artifacts",
    auto_seed: bool = False,
    seed_days: int = 180,
    min_train_rows: int = 5000,
    min_series_rows: int = 30
) -> dict:
    """
    Train all models and save artifacts.
    
    Args:
        bank_id: Optional bank filter
        group_by_location: Whether to group by location
        output_dir: Directory to save artifacts
        auto_seed: Whether to automatically seed data if dataset is insufficient
        seed_days: Number of days to seed if auto_seed is enabled
        min_train_rows: Minimum total rows required for training
        min_series_rows: Minimum rows per series for train/test split
    
    Returns:
        Dictionary with training results
    """
    print("=" * 60)
    print("DEMAND FORECASTING TRAINING PIPELINE")
    print("=" * 60)
    
    seeding_occurred = False
    
    # 1. Build dataset
    print("\n[1/6] Building dataset...")
    db = next(get_db())
    
    try:
        df = build_training_dataset(db, group_by_location=group_by_location)
        
        # Check if dataset is insufficient
        if df.empty or len(df) < min_train_rows:
            if auto_seed:
                print(f"\n⚠️  Dataset insufficient (rows={len(df)}, required={min_train_rows})")
                print(f"   Auto-seeding {seed_days} days of synthetic data...")
                
                rows_inserted = seed_outbound_history(
                    db=db,
                    bank_id=bank_id,
                    days=seed_days,
                    group_by_location=group_by_location
                )
                print(f"   ✓ Seeded {rows_inserted} movement rows")
                seeding_occurred = True
                
                # Re-build dataset after seeding
                print("   Re-building dataset after seeding...")
                df = build_training_dataset(db, group_by_location=group_by_location)
                
                if df.empty or len(df) < min_train_rows:
                    raise ValueError(
                        f"Dataset still insufficient after seeding! "
                        f"Rows: {len(df)}, Required: {min_train_rows}"
                    )
            else:
                raise ValueError(
                    f"Dataset insufficient (rows={len(df)}, required={min_train_rows}).\n"
                    "Options:\n"
                    "  1. Run with --auto-seed to automatically generate synthetic data\n"
                    "  2. Manually seed: python -m app.forecasting.seed_outbound_movements --days 180"
                )
    finally:
        db.close()
    
    print(f"  ✓ Dataset shape: {df.shape}")
    print(f"  ✓ Date range: {df['date'].min()} to {df['date'].max()}")
    
    group_cols = ["bank_id", "item_id"]
    if group_by_location:
        group_cols.append("location_id")
    
    n_series = df.groupby(group_cols).ngroups
    print(f"  ✓ Time series: {n_series}")
    
    # 2. Train/test split
    print("\n[2/6] Splitting train/test (80/20 time-based)...")
    train_df, test_df = time_based_split(df, group_cols=group_cols, min_rows=min_series_rows)
    
    # 2. Train/test split
    print("\n[2/6] Splitting train/test (80/20 time-based)...")
    train_df, test_df = time_based_split(df, group_cols=group_cols, min_rows=min_series_rows)
    
    print(f"  ✓ Train: {len(train_df)} rows")
    print(f"  ✓ Test: {len(test_df)} rows")
    
    if test_df.empty:
        raise ValueError("Test set is empty - insufficient data per series")
    
    # Extract features and target
    X_train = train_df[FEATURE_COLS]
    y_train = train_df["target"]
    X_test = test_df[FEATURE_COLS]
    y_test = test_df["target"]
    
    # 3. Train models
    print("\n[3/6] Training models...")
    models = get_all_models()
    trained_models = {}
    predictions = {}
    
    for name, model in models.items():
        print(f"  • {name}...", end=" ")
        try:
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            trained_models[name] = model
            predictions[name] = y_pred
            print("✓")
        except Exception as e:
            print(f"✗ ({e})")
    
    if not predictions:
        raise RuntimeError("All models failed to train")
    
    # 4. Evaluate
    print("\n[4/6] Evaluating...")
    metrics_df = evaluate_all_models(y_test.values, predictions)
    print("\n" + metrics_df.to_string(index=False))
    
    # 5. Save artifacts
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = Path(output_dir) / timestamp
    run_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n[5/6] Saving artifacts to {run_dir}/...")
    
    # Save best model
    best_model_name = metrics_df.iloc[0]["model"]
    best_model = trained_models[best_model_name]
    model_path = run_dir / "model.joblib"
    joblib.dump(best_model, model_path)
    print(f"  ✓ Model: {model_path}")
    
    # Save config
    config_path = run_dir / "config.json"
    config_dict = {
        "bank_id": bank_id,
        "group_by_location": group_by_location,
        "auto_seed": auto_seed,
        "seed_days": seed_days,
        "seeding_occurred": seeding_occurred,
        "min_train_rows": min_train_rows,
        "min_series_rows": min_series_rows,
    }
    with open(config_path, "w") as f:
        json.dump(config_dict, f, indent=2)
    print(f"  ✓ Config: {config_path}")
    
    # Save metrics
    metrics_path = run_dir / "metrics.json"
    # Save metrics
    metrics_path = run_dir / "metrics.json"
    metrics_dict = {
        "timestamp": timestamp,
        "config": config_dict,
        "dataset": {
            "total_rows": len(df),
            "train_rows": len(train_df),
            "test_rows": len(test_df),
            "n_series": n_series,
            "date_range": {
                "start": str(df["date"].min()),
                "end": str(df["date"].max()),
            }
        },
        "metrics": metrics_df.to_dict(orient="records"),
        "best_model": best_model_name,
    }
    
    with open(metrics_path, "w") as f:
        json.dump(metrics_dict, f, indent=2)
    print(f"  ✓ Metrics: {metrics_path}")
    
    # Save dataset summary
    summary_path = run_dir / "dataset_summary.csv"
    summary = df.groupby(group_cols).agg({
        "date": ["min", "max", "count"],
        "demand_qty": ["mean", "std", "sum"],
    }).reset_index()
    summary.columns = ["_".join(col).strip("_") for col in summary.columns]
    summary.to_csv(summary_path, index=False)
    print(f"  ✓ Summary: {summary_path}")
    
    # Save features preview
    preview_path = run_dir / "features_preview.csv"
    df.head(200).to_csv(preview_path, index=False)
    print(f"  ✓ Preview: {preview_path}")
    
    # 6. Final summary
    print("\n[6/6] Training Summary")
    print("=" * 60)
    if seeding_occurred:
        print(f"🌱 Auto-seeding: YES ({seed_days} days)")
    else:
        print("🌱 Auto-seeding: NO")
    print(f"📊 Train/Test: {len(train_df)} / {len(test_df)} rows")
    print(f"🏆 Best model: {best_model_name}")
    print(f"   • MAE:  {metrics_df.iloc[0]['mae']:.2f}")
    print(f"   • WAPE: {metrics_df.iloc[0]['wape']:.2%}")
    print(f"   • Bias: {metrics_df.iloc[0]['bias']:.4f}")
    print(f"💾 Artifacts: {run_dir}")
    print("=" * 60)
    
    return metrics_dict


def main():
    parser = argparse.ArgumentParser(description="Train demand forecasting models")
    parser.add_argument("--bank-id", type=int, default=None, help="Filter to specific bank")
    parser.add_argument("--group-by-location", action="store_true", help="Train per location")
    parser.add_argument("--output-dir", default="artifacts", help="Output directory for artifacts")
    parser.add_argument("--auto-seed", action="store_true", help="Automatically seed data if insufficient")
    parser.add_argument("--seed-days", type=int, default=180, help="Days of history to seed (default: 180)")
    parser.add_argument("--min-train-rows", type=int, default=5000, help="Minimum total rows for training (default: 5000)")
    parser.add_argument("--min-series-rows", type=int, default=30, help="Minimum rows per series (default: 30)")
    
    args = parser.parse_args()
    
    try:
        train_and_evaluate(
            bank_id=args.bank_id,
            group_by_location=args.group_by_location,
            output_dir=args.output_dir,
            auto_seed=args.auto_seed,
            seed_days=args.seed_days,
            min_train_rows=args.min_train_rows,
            min_series_rows=args.min_series_rows
        )
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        raise


if __name__ == "__main__":
    main()
