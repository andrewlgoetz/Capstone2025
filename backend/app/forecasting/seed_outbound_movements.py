"""
Seed synthetic OUTBOUND movement history for demand forecasting.

Usage:
    python -m app.forecasting.seed_outbound_movements --days 180 --bank-id 1
    python -m app.forecasting.seed_outbound_movements --days 180 --group-by-location
"""
from __future__ import annotations
import argparse
import random
from datetime import datetime, timedelta, time
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.inventory_movement import MovementType


def count_outbound_days_per_series(
    db: Session,
    bank_id: Optional[int] = None,
    group_by_location: bool = False
) -> dict:
    """
    Count how many days of OUTBOUND history exist per (bank_id, item_id[, location_id]).
    Returns dict: {(bank_id, item_id[, location_id]): count_days}
    """
    group_cols = ["inv.bank_id", "invmov.item_id"]
    if group_by_location:
        group_cols.append("invmov.from_location_id")
    
    where = ["invmov.movement_type = 'OUTBOUND'"]
    params = {}
    if bank_id is not None:
        where.append("inv.bank_id = :bank_id")
        params["bank_id"] = bank_id
    
    where_sql = " AND ".join(where)
    group_sql = ", ".join(group_cols)
    
    sql = f"""
        SELECT {group_sql}, COUNT(DISTINCT DATE(invmov.created_at)) as days
        FROM inventory_movement AS invmov
        JOIN inventory AS inv ON invmov.item_id = inv.item_id
        WHERE {where_sql}
        GROUP BY {group_sql}
    """
    
    result = db.execute(text(sql), params).fetchall()
    counts = {}
    for row in result:
        if group_by_location:
            key = (row[0], row[1], row[2])  # bank_id, item_id, location_id
        else:
            key = (row[0], row[1])  # bank_id, item_id
        counts[key] = row[-1]
    
    return counts


def seed_outbound_history(
    db: Session,
    bank_id: Optional[int] = None,
    days: int = 180,
    per_item_daily_prob: float = 0.7,
    group_by_location: bool = False,
    reason: str = "synthetic_seed",
) -> int:
    """
    Seed synthetic OUTBOUND movements for training data.
    
    Args:
        db: Database session
        bank_id: Optional bank filter (None = all banks)
        days: Number of days of history to generate (backwards from today)
        per_item_daily_prob: Probability of movement on any given day (0.0-1.0)
        group_by_location: Whether to use location_id in seeding
        reason: Reason field for all seeded movements
    
    Returns:
        Number of movement rows inserted
    """
    # 1) Query inventory items to seed
    query = "SELECT item_id, bank_id, location_id FROM inventory"
    params = {}
    if bank_id is not None:
        query += " WHERE bank_id = :bank_id"
        params["bank_id"] = bank_id
    
    items = db.execute(text(query), params).fetchall()
    if not items:
        print(f"No inventory items found for bank_id={bank_id}")
        return 0
    
    print(f"Found {len(items)} items to seed movements for")
    
    # 2) Generate date range [today - days, today - 1]
    end_date = datetime.now().date() - timedelta(days=1)
    start_date = end_date - timedelta(days=days - 1)
    
    # 3) Check existing movements to avoid duplicates
    existing_sql = """
        SELECT item_id, DATE(created_at) as move_date
        {location_col}
        FROM inventory_movement
        WHERE movement_type = 'OUTBOUND'
          AND DATE(created_at) >= :start_date
          AND DATE(created_at) <= :end_date
        {bank_filter}
    """
    
    location_col = ", from_location_id" if group_by_location else ""
    bank_filter = "AND item_id IN (SELECT item_id FROM inventory WHERE bank_id = :bank_id)" if bank_id else ""
    
    existing_sql = existing_sql.format(location_col=location_col, bank_filter=bank_filter)
    existing_params = {"start_date": start_date, "end_date": end_date}
    if bank_id:
        existing_params["bank_id"] = bank_id
    
    existing = db.execute(text(existing_sql), existing_params).fetchall()
    
    # Build set of existing (item_id, date[, location_id]) tuples
    existing_set = set()
    for row in existing:
        if group_by_location:
            existing_set.add((row[0], row[1], row[2]))  # item_id, date, location_id
        else:
            existing_set.add((row[0], row[1]))  # item_id, date
    
    print(f"Found {len(existing_set)} existing movement records in date range")
    
    # 4) Insert synthetic movements
    inserted = 0
    current_date = start_date
    
    while current_date <= end_date:
        is_weekend = current_date.weekday() >= 5  # 5=Sat, 6=Sun
        
        for item_id, item_bank_id, location_id in items:
            # Check if movement should occur (probabilistic)
            if random.random() > per_item_daily_prob:
                continue
            
            # Check for duplicates
            if group_by_location:
                if (item_id, current_date, location_id) in existing_set:
                    continue
            else:
                if (item_id, current_date) in existing_set:
                    continue
            
            # Generate realistic quantity
            base_qty = random.randint(1, 4)
            
            # Weekend boost
            if is_weekend:
                base_qty += 2
            
            # Occasional spike (5% chance)
            if random.random() < 0.05:
                base_qty += random.randint(8, 15)
            
            # Small noise
            base_qty += random.randint(-1, 1)
            base_qty = max(1, base_qty)  # Ensure at least 1
            
            # Create timestamp at midday
            created_at = datetime.combine(current_date, time(12, 0, 0))
            
            # Insert movement
            insert_sql = """
                INSERT INTO inventory_movement 
                (item_id, quantity_change, movement_type, reason, from_location_id, created_at)
                VALUES (:item_id, :quantity_change, :movement_type, :reason, :from_location_id, :created_at)
            """
            
            db.execute(text(insert_sql), {
                "item_id": item_id,
                "quantity_change": -base_qty,  # Negative for OUTBOUND
                "movement_type": MovementType.OUTBOUND.value,
                "reason": reason,
                "from_location_id": location_id if group_by_location else None,
                "created_at": created_at
            })
            inserted += 1
        
        current_date += timedelta(days=1)
    
    db.commit()
    print(f"✅ Inserted {inserted} synthetic OUTBOUND movements")
    return inserted


def check_if_seeding_needed(
    db: Session,
    bank_id: Optional[int] = None,
    group_by_location: bool = False,
    min_days: int = 30,
    min_nonzero_days: int = 14
) -> bool:
    """
    Check if seeding is needed based on existing movement history.
    
    Returns True if ANY series has insufficient data.
    """
    counts = count_outbound_days_per_series(db, bank_id, group_by_location)
    
    if not counts:
        print("⚠️  No OUTBOUND movements found - seeding needed")
        return True
    
    insufficient = []
    for key, days in counts.items():
        if days < min_days or days < min_nonzero_days:
            insufficient.append((key, days))
    
    if insufficient:
        print(f"⚠️  {len(insufficient)} series have insufficient data (< {min_days} days)")
        for key, days in insufficient[:5]:  # Show first 5
            print(f"   {key}: {days} days")
        return True
    
    print(f"✅ All {len(counts)} series have sufficient history (>= {min_days} days)")
    return False


def main():
    parser = argparse.ArgumentParser(description="Seed synthetic OUTBOUND movements")
    parser.add_argument("--days", type=int, default=180, help="Days of history to generate")
    parser.add_argument("--bank-id", type=int, default=None, help="Filter to specific bank")
    parser.add_argument("--group-by-location", action="store_true", help="Seed per location")
    parser.add_argument("--prob", type=float, default=0.7, help="Daily movement probability (0.0-1.0)")
    parser.add_argument("--force", action="store_true", help="Skip insufficiency check and seed anyway")
    parser.add_argument("--check-only", action="store_true", help="Only check if seeding needed, don't seed")
    
    args = parser.parse_args()
    
    db = next(get_db())
    
    try:
        # Check if seeding is needed
        needs_seeding = check_if_seeding_needed(
            db, 
            bank_id=args.bank_id,
            group_by_location=args.group_by_location
        )
        
        if args.check_only:
            return
        
        if not needs_seeding and not args.force:
            print("✅ Sufficient data exists. Use --force to seed anyway.")
            return
        
        # Perform seeding
        inserted = seed_outbound_history(
            db,
            bank_id=args.bank_id,
            days=args.days,
            per_item_daily_prob=args.prob,
            group_by_location=args.group_by_location
        )
        
        print(f"\n✅ Seeding complete: {inserted} movements inserted over {args.days} days")
        
    finally:
        db.close()


if __name__ == "__main__":
    main()
