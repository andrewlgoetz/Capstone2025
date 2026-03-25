"""
seed_forecast_movements.py — Incremental OUTBOUND movement seeder for forecast testing.

Adds weekly OUTBOUND movements to the database so you can observe how the
forecasting model behaves at different history lengths and under different
demand patterns.

USAGE
-----
  # Add 4 weeks of normal demand for bank 1 (run repeatedly to grow history)
  python seed_forecast_movements.py

  # Add 2 weeks at a time
  python seed_forecast_movements.py --weeks 2

  # Add a demand spike in Canned Goods for 2 weeks
  python seed_forecast_movements.py --scenario spike --spike-category "Canned Goods" --spike-multiplier 4

  # Drop demand in Produce (simulate a stockout / seasonal low)
  python seed_forecast_movements.py --scenario drop --spike-category Produce --spike-multiplier 0.1

  # Restore to normal after a spike/drop
  python seed_forecast_movements.py --scenario normal

  # Make a category intermittent (many zero weeks) for 8 weeks
  python seed_forecast_movements.py --weeks 8 --scenario intermittent --spike-category Dairy

  # See what would be inserted without writing to DB
  python seed_forecast_movements.py --dry-run

  # Wipe all seeded OUTBOUND movements for this bank and start fresh
  python seed_forecast_movements.py --reset

  # Different bank
  python seed_forecast_movements.py --bank-id 2

SCENARIOS
---------
  normal       Steady demand with mild random noise.  Default.
  spike        Chosen category gets spike_multiplier × normal demand.
               All other categories are normal.
  drop         Chosen category gets spike_multiplier × normal demand
               (use --spike-multiplier 0.1 for near-zero / stockout).
  intermittent Chosen category has ~65 % zero weeks (demand arrives in bursts).
  recovery     Chosen category ramps back from 20 % -> 100 % of baseline
               (simulates restocking / demand recovery after a gap).
"""

import argparse
import random
import sys
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

# ---------------------------------------------------------------------------
# Bootstrap the app's DB session (same pattern as the app itself)
# ---------------------------------------------------------------------------
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal
from app.models.inventory import InventoryItem
from app.models.inventory_movement import InventoryMovement, MovementType


# ---------------------------------------------------------------------------
# Per-category baseline weekly demand (units/week, food-bank scale)
# Roughly calibrated to a mid-size food bank distributing to ~200 families/week
# ---------------------------------------------------------------------------
CATEGORY_BASELINE: Dict[str, Tuple[float, float]] = {
    # category          (mean, std_dev)   std ≈ 7-8 % of mean so weekly series
    # look like a learnable pattern rather than white noise.
    "Canned Goods":    (120.0,  8.0),
    "Grains":          ( 95.0,  7.0),
    "Produce":         ( 85.0,  7.0),
    "Dairy":           ( 55.0,  4.0),
    "Meat":            ( 48.0,  4.0),
    "Frozen":          ( 42.0,  3.0),
    "Beverages":       ( 70.0,  5.0),
    "Snacks":          ( 38.0,  3.0),
    "Spreads":         ( 28.0,  2.0),
    "Refrigerated":    ( 35.0,  3.0),
    "Other":           ( 20.0,  2.0),
}

# Fallback for categories not in the table above
_DEFAULT_BASELINE: Tuple[float, float] = (40.0, 8.0)


def _monday(dt: datetime) -> datetime:
    """Return the Monday of the week containing dt."""
    return (dt - timedelta(days=dt.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
    )


def _last_outbound_monday(db: Session, bank_id: int) -> Optional[datetime]:
    """Return the most recent Monday that has OUTBOUND movement for this bank, or None."""
    row = db.execute(
        text("""
            SELECT MAX(im.created_at)
            FROM inventory_movement im
            JOIN inventory i ON im.item_id = i.item_id
            WHERE im.movement_type = 'OUTBOUND'
              AND i.bank_id = :bank_id
        """),
        {"bank_id": bank_id},
    ).fetchone()
    if row and row[0]:
        return _monday(row[0].replace(tzinfo=timezone.utc) if row[0].tzinfo is None else row[0])
    return None


def _items_by_category(db: Session, bank_id: int) -> Dict[str, List[int]]:
    """Return {category: [item_id, ...]} for all active items in the bank."""
    items = (
        db.query(InventoryItem.item_id, InventoryItem.category)
        .filter(InventoryItem.bank_id == bank_id)
        .all()
    )
    result: Dict[str, List[int]] = {}
    for item_id, category in items:
        cat = (category or "Other").strip()
        result.setdefault(cat, []).append(item_id)
    return result


def _weekly_demand(
    category: str,
    scenario: str,
    spike_category: Optional[str],
    spike_multiplier: float,
    week_index: int,       # 0-based index within the batch
    total_weeks: int,
    rng: random.Random,
) -> int:
    """
    Compute a single week's demand quantity for one category.
    Returns 0 for zero-demand weeks (which produce no movement record).
    """
    mean, std = CATEGORY_BASELINE.get(category, _DEFAULT_BASELINE)
    base = max(1.0, rng.gauss(mean, std))

    is_target = spike_category and category.lower() == spike_category.lower()

    if scenario == "normal":
        qty = base

    elif scenario == "spike":
        qty = base * spike_multiplier if is_target else base

    elif scenario == "drop":
        qty = base * spike_multiplier if is_target else base  # use multiplier < 1

    elif scenario == "intermittent":
        if is_target:
            # 65 % chance of zero demand; spiky when demand arrives
            qty = 0.0 if rng.random() < 0.65 else base * rng.uniform(1.2, 2.5)
        else:
            qty = base

    elif scenario == "recovery":
        if is_target:
            # Ramp from 20 % up to 100 % of baseline across the batch
            progress = week_index / max(total_weeks - 1, 1)
            multiplier = 0.2 + 0.8 * progress
            qty = base * multiplier
        else:
            qty = base

    else:
        qty = base

    return max(0, int(round(qty)))


def seed_movements(
    bank_id: int,
    weeks: int,
    scenario: str,
    spike_category: Optional[str],
    spike_multiplier: float,
    seed: int,
    dry_run: bool,
    reset: bool,
) -> None:
    db: Session = SessionLocal()
    rng = random.Random(seed)

    try:
        if reset:
            deleted = db.execute(
                text("""
                    DELETE FROM inventory_movement
                    WHERE movement_type = 'OUTBOUND'
                      AND item_id IN (
                          SELECT item_id FROM inventory WHERE bank_id = :bank_id
                      )
                """),
                {"bank_id": bank_id},
            ).rowcount
            if not dry_run:
                db.commit()
            print(f"{'[DRY RUN] Would delete' if dry_run else 'Deleted'} {deleted} existing OUTBOUND rows for bank {bank_id}.")

        # --- Determine start date ---
        last_monday = _last_outbound_monday(db, bank_id)
        if last_monday:
            start_monday = last_monday + timedelta(weeks=1)
            print(f"Last OUTBOUND week detected: {last_monday.date()}  -> appending from {start_monday.date()}")
        else:
            # No history yet — start 12 weeks ago so the model has a training window
            start_monday = _monday(datetime.now(timezone.utc)) - timedelta(weeks=12)
            print(f"No existing OUTBOUND data found -> seeding from scratch starting {start_monday.date()}")

        # --- Gather items ---
        cat_items = _items_by_category(db, bank_id)
        if not cat_items:
            print(f"ERROR: No inventory items found for bank_id={bank_id}. Run seed_db.py first.")
            return

        print(f"\nCategories found for bank {bank_id}:")
        for cat, ids in sorted(cat_items.items()):
            print(f"  {cat:<20} {len(ids)} item(s)")

        print(f"\nScenario : {scenario.upper()}", end="")
        if spike_category and scenario != "normal":
            print(f"  (target category: {spike_category}, multiplier: {spike_multiplier}×)", end="")
        print(f"\nWeeks    : {weeks}")
        print(f"Start    : {start_monday.date()}  to  {(start_monday + timedelta(weeks=weeks-1)).date()}")
        if dry_run:
            print("\n[DRY RUN - no database writes]\n")

        # --- Generate movements ---
        movements: List[InventoryMovement] = []

        for week_offset in range(weeks):
            week_dt = start_monday + timedelta(weeks=week_offset)
            # Spread individual transactions across Mon–Fri of that week
            for category, item_ids in sorted(cat_items.items()):
                qty = _weekly_demand(
                    category=category,
                    scenario=scenario,
                    spike_category=spike_category,
                    spike_multiplier=spike_multiplier,
                    week_index=week_offset,
                    total_weeks=weeks,
                    rng=rng,
                )
                if qty == 0:
                    continue  # zero demand week -- no movement record

                # Split demand across 1–3 transactions in the week (more realistic)
                n_txns = rng.randint(1, min(3, len(item_ids)))
                item_ids_for_week = rng.choices(item_ids, k=n_txns)
                # Distribute qty roughly evenly across transactions
                remaining = qty
                for i, item_id in enumerate(item_ids_for_week):
                    if i == len(item_ids_for_week) - 1:
                        txn_qty = remaining
                    else:
                        txn_qty = max(1, int(remaining * rng.uniform(0.3, 0.7)))
                        remaining -= txn_qty
                    if txn_qty <= 0:
                        continue

                    # Random timestamp within business hours Mon–Fri of this week
                    day_offset = rng.randint(0, 4)           # Mon=0 … Fri=4
                    hour = rng.randint(8, 17)
                    minute = rng.randint(0, 59)
                    txn_dt = week_dt.replace(hour=hour, minute=minute) + timedelta(days=day_offset)

                    movements.append(InventoryMovement(
                        item_id=item_id,
                        quantity_change=-txn_qty,             # negative = outbound
                        movement_type=MovementType.OUTBOUND,
                        reason="Seeded demand data",
                        created_at=txn_dt,
                    ))

        # --- Summary ---
        total_qty = sum(-m.quantity_change for m in movements)
        print(f"\nGenerated {len(movements)} movement transactions, {total_qty} total units across {weeks} weeks.")

        if not movements:
            print("Nothing to insert.")
            return

        # --- Per-category summary ---
        cat_totals: Dict[str, int] = {}
        for m in movements:
            # Look up category via item_id
            for cat, ids in cat_items.items():
                if m.item_id in ids:
                    cat_totals[cat] = cat_totals.get(cat, 0) + (-m.quantity_change)
                    break
        print("\nPer-category totals:")
        for cat, total in sorted(cat_totals.items()):
            baseline_mean = CATEGORY_BASELINE.get(cat, _DEFAULT_BASELINE)[0]
            per_week = total / weeks
            print(f"  {cat:<20} {total:>5} units  ({per_week:5.1f}/wk vs baseline {baseline_mean:.0f}/wk)")

        if not dry_run:
            db.add_all(movements)
            db.commit()
            print(f"\nInserted {len(movements)} movements into the database.")
            print("  Run  POST /forecasts/run  to retrain the model on this data.")
        else:
            print("\n[DRY RUN] Nothing written. Remove --dry-run to commit.")

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed incremental OUTBOUND movements for forecast model testing.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--bank-id", type=int, default=1,
        help="Food bank ID to seed movements for (default: 1)",
    )
    parser.add_argument(
        "--weeks", type=int, default=4,
        help="Number of weeks of movements to add (default: 4)",
    )
    parser.add_argument(
        "--scenario",
        choices=["normal", "spike", "drop", "intermittent", "recovery"],
        default="normal",
        help="Demand pattern to generate (default: normal)",
    )
    parser.add_argument(
        "--spike-category", type=str, default=None,
        metavar="CATEGORY",
        help="Category name to apply spike/drop/intermittent/recovery to. "
             'e.g. "Canned Goods", Produce, Dairy',
    )
    parser.add_argument(
        "--spike-multiplier", type=float, default=4.0,
        metavar="X",
        help="Demand multiplier for the spike/drop category. "
             ">1 = higher demand (spike); <1 = lower demand (drop). Default: 4.0",
    )
    parser.add_argument(
        "--seed", type=int, default=42,
        help="Random seed for reproducibility (default: 42)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print what would be inserted without writing to the database",
    )
    parser.add_argument(
        "--reset", action="store_true",
        help="Delete ALL existing OUTBOUND movements for this bank before seeding",
    )

    args = parser.parse_args()

    # Validate spike_category is required for non-normal scenarios
    if args.scenario in ("spike", "drop", "intermittent", "recovery") and not args.spike_category:
        parser.error(
            f"--spike-category is required when --scenario={args.scenario}\n"
            f"  Available categories: {', '.join(sorted(CATEGORY_BASELINE))}"
        )

    if args.reset and not args.dry_run:
        confirm = input(
            f"This will DELETE all OUTBOUND movements for bank {args.bank_id}. "
            "Type 'yes' to confirm: "
        )
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            return

    seed_movements(
        bank_id=args.bank_id,
        weeks=args.weeks,
        scenario=args.scenario,
        spike_category=args.spike_category,
        spike_multiplier=args.spike_multiplier,
        seed=args.seed,
        dry_run=args.dry_run,
        reset=args.reset,
    )


if __name__ == "__main__":
    main()
