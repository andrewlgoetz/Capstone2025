#!/usr/bin/env python
"""
Quick end-to-end test of the forecasting pipeline.

Run from backend directory:
    python -m app.forecasting.test_pipeline
"""
import sys
from pathlib import Path

from app.database import get_db
from app.forecasting.seed_outbound_movements import check_if_seeding_needed, seed_outbound_history
from app.forecasting.train import train_and_evaluate


def test_pipeline(bank_id: int = 1, skip_seed: bool = False):
    """Run full pipeline test."""
    print("=" * 70)
    print("FORECASTING PIPELINE TEST")
    print("=" * 70)
    
    db = next(get_db())
    
    try:
        # Step 1: Check/seed data
        if not skip_seed:
            print("\n[Step 1/2] Checking data availability...")
            needs_seeding = check_if_seeding_needed(db, bank_id=bank_id)
            
            if needs_seeding:
                print("   Seeding 90 days of synthetic data...")
                inserted = seed_outbound_history(
                    db,
                    bank_id=bank_id,
                    days=90,
                    per_item_daily_prob=0.7
                )
                print(f"   ✓ Seeded {inserted} movements")
            else:
                print("   ✓ Sufficient data exists")
        else:
            print("\n[Step 1/2] Skipping seeding (--skip-seed)")
        
        # Step 2: Train
        print("\n[Step 2/2] Training models...")
        results = train_and_evaluate(
            bank_id=bank_id,
            group_by_location=False,
            output_dir="artifacts_test"
        )
        
        print("\n" + "=" * 70)
        print("✅ PIPELINE TEST COMPLETE")
        print("=" * 70)
        print(f"Best model: {results['best_model']}")
        print(f"Test MAE: {results['metrics'][0]['mae']:.2f}")
        print(f"Test WAPE: {results['metrics'][0]['wape']:.2%}")
        print("\nArtifacts saved to: artifacts_test/")
        print("=" * 70)
        
        return True
        
    except Exception as e:
        print(f"\n❌ Pipeline test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        db.close()


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Test forecasting pipeline")
    parser.add_argument("--bank-id", type=int, default=1, help="Bank ID to test with")
    parser.add_argument("--skip-seed", action="store_true", help="Skip seeding step")
    
    args = parser.parse_args()
    
    success = test_pipeline(bank_id=args.bank_id, skip_seed=args.skip_seed)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
