"""
Debug and validate the demand forecasting dataset.

Usage:
    python -m app.forecasting.debug_dataset
    python -m app.forecasting.debug_dataset --min-series 50 --min-rows 5000
    python -m app.forecasting.debug_dataset --group-by-location --min-days 90
"""
import argparse
import pandas as pd

from app.database import get_db
from app.forecasting.dataset_builder import build_training_dataset
from app.forecasting.data_extractions import extract_demand_forecast_data, DemandForecast


def debug_dataset(
    group_by_location: bool = False,
    min_series_with_history: int = 50,
    min_days_per_series: int = 60,
    min_total_rows: int = 5000
):
    """
    Validate dataset quality and print comprehensive diagnostics.
    
    Args:
        group_by_location: Whether to group by location
        min_series_with_history: Minimum number of series with sufficient history
        min_days_per_series: Minimum days required per series
        min_total_rows: Minimum total rows required in dataset
    
    Raises:
        AssertionError: If dataset doesn't meet minimum thresholds
    """
    print("=" * 70)
    print("DATASET VALIDATION & DIAGNOSTICS")
    print("=" * 70)
    
    db = next(get_db())
    
    try:
        # 1. Get raw data before feature engineering
        print("\n[1/4] Extracting raw demand data...")
        raw_data = extract_demand_forecast_data(
            db=db, 
            config=DemandForecast(group_by_location=group_by_location)
        )
        
        # Determine group columns based on actual data
        group_cols = ["bank_id", "item_id"]
        if group_by_location:
            # Check which location column exists in the data
            if "location_id" in raw_data.columns:
                group_cols.append("location_id")
            elif "from_location_id" in raw_data.columns:
                group_cols.append("from_location_id")
        
        n_series_raw = raw_data.groupby(group_cols).ngroups if not raw_data.empty else 0
        rows_raw = len(raw_data)
        
        print(f"   ✓ Raw data: {rows_raw:,} rows, {n_series_raw} series")
        
        # 2. Build full dataset with features
        print("\n[2/4] Building dataset with features...")
        df = build_training_dataset(db, group_by_location=group_by_location)
        
        if df.empty:
            print("   ⚠️  Dataset is EMPTY after feature engineering!")
            n_series_final = 0
            rows_final = 0
            series_with_enough_history = 0
            pct_with_lag7 = 0
            pct_with_target = 0
        else:
            print(f"   ✓ Built dataset: {len(df):,} rows")
            
            # 3. Calculate statistics
            n_series_final = df.groupby(group_cols).ngroups
            rows_final = len(df)
            
            # Series-level stats
            series_counts = df.groupby(group_cols)["date"].count()
            series_with_enough_history = (series_counts >= min_days_per_series).sum()
            
            # Feature statistics
            pct_with_lag7 = (df["lag_7"].notna().sum() / rows_final) * 100 if "lag_7" in df.columns else 0
            
            # Determine target column dynamically
            target_col = None
            possible_targets = ["y_next_day", "target", "demand_next_day", "demand_qty_next_day"]
            for col in possible_targets:
                if col in df.columns:
                    target_col = col
                    break
            
            if target_col:
                pct_with_target = (df[target_col].notna().sum() / rows_final) * 100
            else:
                pct_with_target = None
        
        rows_dropped = rows_raw - rows_final
        
        # 4. Print diagnostics
        print("\n[3/4] Dataset Statistics")
        print("=" * 70)
        
        print(f"\n📊 SERIES STATISTICS")
        print(f"   Raw series (before features):  {n_series_raw:>6}")
        print(f"   Final series (after features): {n_series_final:>6}")
        if n_series_final > 0:
            print(f"   Series with ≥{min_days_per_series} days:       {series_with_enough_history:>6}")
        
        print(f"\n📋 ROW STATISTICS")
        print(f"   Raw rows:       {rows_raw:>8,}")
        print(f"   Final rows:     {rows_final:>8,}")
        print(f"   Rows dropped:   {rows_dropped:>8,} ({rows_dropped/rows_raw*100 if rows_raw > 0 else 0:.1f}%)")
        
        if rows_final > 0:
            print(f"\n🔍 FEATURE COMPLETENESS")
            print(f"   Rows with non-null lag_7:   {pct_with_lag7:>5.1f}%")
            if pct_with_target is not None:
                print(f"   Rows with non-null target:  {pct_with_target:>5.1f}%")
            else:
                print(f"   Rows with non-null target:    N/A (target column not found)")
        
        print(f"\n❓ WHY ROWS ARE DROPPED:")
        print(f"   • First 7 days per series:")
        print(f"     - No lag_7 feature (need 7 days history)")
        print(f"     - No rolling_mean_7 (need 7 days for window)")
        print(f"   • Last day per series:")
        print(f"     - No target (next-day demand not yet available)")
        print(f"   • Additional filtering:")
        print(f"     - Series with <30 rows filtered in train/test split")
        print(f"     - Rows with NaN in features or target are dropped")
        
        # 5. Sanity checks
        print("\n[4/4] Sanity Checks")
        print("=" * 70)
        print(f"\n📏 THRESHOLDS (configurable via CLI args)")
        print(f"   Min series with ≥{min_days_per_series} days:  {min_series_with_history}")
        print(f"   Min total rows:              {min_total_rows:,}")
        
        passed_series_check = series_with_enough_history >= min_series_with_history
        passed_rows_check = rows_final >= min_total_rows
        
        print(f"\n✅ VALIDATION RESULTS")
        print(f"   Series check: {'✅ PASS' if passed_series_check else '❌ FAIL'} "
              f"({series_with_enough_history} {'≥' if passed_series_check else '<'} {min_series_with_history})")
        print(f"   Rows check:   {'✅ PASS' if passed_rows_check else '❌ FAIL'} "
              f"({rows_final:,} {'≥' if passed_rows_check else '<'} {min_total_rows:,})")
        
        # Assertion logic: PASS if EITHER condition met
        overall_pass = passed_series_check or passed_rows_check
        
        if not overall_pass:
            print("\n" + "=" * 70)
            print("❌ DATASET INSUFFICIENT!")
            print("=" * 70)
            print(f"\n   Dataset does not meet minimum thresholds.")
            print(f"   Need EITHER:")
            print(f"     • At least {min_series_with_history} series with ≥{min_days_per_series} days each")
            print(f"     • OR at least {min_total_rows:,} total rows")
            print(f"\n   Current status:")
            print(f"     • {series_with_enough_history} series with ≥{min_days_per_series} days")
            print(f"     • {rows_final:,} total rows")
            print(f"\n   💡 To fix: Run seeding to generate synthetic history:")
            print(f"      python -m app.forecasting.seed_outbound_movements --days 180")
            if group_by_location:
                print(f"      python -m app.forecasting.seed_outbound_movements --days 180 --group-by-location")
            print()
            
            raise AssertionError(
                f"Dataset insufficient: {series_with_enough_history} series with ≥{min_days_per_series} days "
                f"(need {min_series_with_history}) AND {rows_final:,} rows (need {min_total_rows:,}). "
                f"At least one threshold must be met."
            )
        
        print(f"\n   Overall: {'✅ PASS' if overall_pass else '❌ FAIL'} (at least one threshold met)")
        print("\n" + "=" * 70)
        print("✅ DATASET VALIDATION PASSED")
        print("=" * 70)
        
        # Show sample
        if rows_final > 0:
            print("\n📄 SAMPLE DATA (first 10 rows):")
            display_cols = group_cols + ["date", "demand_qty"]
            # Add feature columns if they exist
            for col in ["lag_1", "lag_7", "rolling_mean_7", "day_of_week", "is_weekend", "month"]:
                if col in df.columns:
                    display_cols.append(col)
            # Add target if it exists
            if target_col and target_col not in display_cols:
                display_cols.append(target_col)
            
            available_cols = [c for c in display_cols if c in df.columns]
            print(df[available_cols].head(10).to_string(index=False))
            print()
        
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Debug and validate demand forecasting dataset",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m app.forecasting.debug_dataset
  python -m app.forecasting.debug_dataset --min-series 100 --min-rows 10000
  python -m app.forecasting.debug_dataset --group-by-location --min-days 90
        """
    )
    parser.add_argument(
        "--group-by-location", 
        action="store_true", 
        help="Group by location (include location_id in series definition)"
    )
    parser.add_argument(
        "--min-series", 
        type=int, 
        default=50, 
        help="Minimum number of series with sufficient history (default: 50)"
    )
    parser.add_argument(
        "--min-days", 
        type=int, 
        default=60,
        help="Minimum days per series to count as 'sufficient history' (default: 60)"
    )
    parser.add_argument(
        "--min-rows", 
        type=int, 
        default=5000,
        help="Minimum total rows in final dataset (default: 5000)"
    )
    
    args = parser.parse_args()
    
    try:
        debug_dataset(
            group_by_location=args.group_by_location,
            min_series_with_history=args.min_series,
            min_days_per_series=args.min_days,
            min_total_rows=args.min_rows
        )
    except AssertionError as e:
        print(f"\n💥 Validation Error: {e}\n")
        exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected Error: {e}\n")
        raise


if __name__ == "__main__":
    main()
