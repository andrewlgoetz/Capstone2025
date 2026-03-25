"""
seed_from_fcc.py — Import FCC real distribution data as OUTBOUND movements.

Reads the FCC Excel workbook (both sheets), normalises dates and item types,
then inserts one InventoryMovement(OUTBOUND) row per source row.  Each
movement is linked to a synthetic "FCC Import" inventory item created per
canonical category so the forecasting extractor can join back to bank_id and
category.

USAGE
-----
  # Preview without writing
  python seed_from_fcc.py --dry-run

  # Import into bank 1 (default)
  python seed_from_fcc.py

  # Import into a specific bank
  python seed_from_fcc.py --bank-id 2

  # Provide an explicit Excel path
  python seed_from_fcc.py --data "/path/to/FCC Data.xlsx"

  # Remove all previously-imported FCC rows before re-importing
  python seed_from_fcc.py --reset

FLAGS
-----
  --data PATH     Path to the FCC Excel file.  Auto-detected if omitted.
  --bank-id INT   Target food bank (default: 1).
  --dry-run       Print a summary and preview without writing to the DB.
  --reset         Delete all OUTBOUND movements with reason='FCC_IMPORT' for
                  this bank before importing.  Safe to run repeatedly.
"""

from __future__ import annotations

import argparse
import sys
from datetime import timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd

# ---------------------------------------------------------------------------
# Bootstrap the app's DB session (must run from backend/ directory)
# ---------------------------------------------------------------------------
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal
from app.models.inventory import InventoryItem
from app.models.inventory_movement import InventoryMovement, MovementType
from sqlalchemy import text
from sqlalchemy.orm import Session


# ---------------------------------------------------------------------------
# FCC Item Type -> canonical aggregate category mapping
# ---------------------------------------------------------------------------

FCC_CATEGORY_MAP: dict[str, str] = {
    # Grains
    "GRAINS":                                     "Grains & Pasta",
    "GRAINS ":                                    "Grains & Pasta",
    # Misc / Snacks
    "MISC ITEMS - SNACKS, BEVERAGES, CONDIMENTS": "Snacks",
    "MISC ITEMS":                                 "Snacks",
    "MISC":                                       "Snacks",
    "SNACKS":                                     "Snacks",
    "SNACKS, BEVERAGES, CONDIMENTS":              "Snacks",
    # Canned Goods (soups, beans)
    "SOUPS + SAUCES":                             "Canned Goods",
    "SOUP & BREAD":                               "Canned Goods",
    "SOUPS":                                      "Canned Goods",
    "BEANS + LEGUMES":                            "Canned Goods",
    "BEANS":                                      "Canned Goods",
    "CANNED GOODS":                               "Canned Goods",
    # Meat & Seafood
    "PROTEINS + ALTERNATIVES":                    "Meat & Seafood",
    "PROTEINS":                                   "Meat & Seafood",
    "PROTEIN":                                    "Meat & Seafood",
    # Fresh Produce
    "FRUITS + VEGETABLES":                        "Fresh Produce",
    "FRUITS AND VEGETABLES":                      "Fresh Produce",
    "FRUITS & VEGETABLES":                        "Fresh Produce",
    "PRODUCE":                                    "Fresh Produce",
    # Personal Care / Hygiene -> Other (FCC does not separate PC category)
    "HYGIENE":                                    "Other",
    "TOILETRIES":                                 "Other",
    "HYGIENE, TOILETRIES":                        "Other",
    "PERSONAL CARE":                              "Other",
    # Dairy & Eggs
    "DAIRY":                                      "Dairy & Eggs",
    "DAIRY, REFRIGERATED/FROZEN GOODS":           "Dairy & Eggs",
    "REFRIGERATED/FROZEN GOODS":                  "Dairy & Eggs",
    "REFRIGERATED":                               "Dairy & Eggs",
}

FCC_KEYWORD_MAP: list[tuple[str, str]] = [
    ("grain",    "Grains & Pasta"),
    ("pasta",    "Grains & Pasta"),
    ("rice",     "Grains & Pasta"),
    ("bread",    "Grains & Pasta"),
    ("cereal",   "Grains & Pasta"),
    ("soup",     "Canned Goods"),
    ("bean",     "Canned Goods"),
    ("can",      "Canned Goods"),
    ("protein",  "Meat & Seafood"),
    ("meat",     "Meat & Seafood"),
    ("poultry",  "Meat & Seafood"),
    ("fruit",    "Fresh Produce"),
    ("veg",      "Fresh Produce"),
    ("produce",  "Fresh Produce"),
    ("dairy",    "Dairy & Eggs"),
    ("milk",     "Dairy & Eggs"),
    ("egg",      "Dairy & Eggs"),
    ("snack",    "Snacks"),
    ("misc",     "Snacks"),
    ("bev",      "Beverages"),
    ("juice",    "Beverages"),
    ("water",    "Beverages"),
    ("hygiene",  "Other"),
    ("toiletry", "Other"),
]


def map_fcc_category(raw: str) -> str:
    """Map a raw FCC Item Type string to a canonical aggregate category."""
    if not raw or (hasattr(raw, '__class__') and raw.__class__.__name__ == 'float'):
        return "Other"
    try:
        import math
        if math.isnan(float(raw)):
            return "Other"
    except (ValueError, TypeError):
        pass
    cleaned = str(raw).strip().upper()
    if cleaned in FCC_CATEGORY_MAP:
        return FCC_CATEGORY_MAP[cleaned]
    lower = cleaned.lower()
    for keyword, cat in FCC_KEYWORD_MAP:
        if keyword in lower:
            return cat
    return "Other"


# ---------------------------------------------------------------------------
# Excel loading (same logic as eval_models_fcc.py)
# ---------------------------------------------------------------------------

def _find_fcc_file() -> Optional[Path]:
    """Try common locations for the FCC Excel file."""
    candidates = [
        Path(__file__).parent / "FCC Data \u2013 Inventory Tracking System Project (2024-2026).xlsx",
        Path(__file__).parent / "FCC_Data.xlsx",
        Path.home() / "Downloads" / "FCC Data \u2013 Inventory Tracking System Project (2024-2026).xlsx",
        Path.home() / "Downloads" / "FCC_Data.xlsx",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


def load_fcc_data(path: Optional[Path] = None) -> pd.DataFrame:
    """
    Load and parse the FCC Excel workbook.

    Returns a DataFrame with columns:
        date         - distribution datetime (timezone-naive, UTC assumed)
        category     - canonical aggregate category name
        quantity     - number of items distributed (positive int)
    """
    if path is None:
        path = _find_fcc_file()
    if path is None or not Path(path).exists():
        sys.exit(
            "ERROR: FCC Excel file not found.\n"
            "Pass --data PATH_TO_XLSX or place the file in the backend/ directory.\n"
        )

    print(f"Loading: {path}")
    xl = pd.ExcelFile(path)
    print(f"  Sheets: {xl.sheet_names}")

    frames: list[pd.DataFrame] = []

    for sheet in xl.sheet_names:
        raw = xl.parse(sheet, header=0)

        # Detect date column
        date_col = None
        for col in raw.columns:
            col_lower = str(col).strip().lower()
            if col_lower in ("date", "session date", "distribution date", "week"):
                date_col = col
                break
        if date_col is None:
            for col in raw.columns[:3]:
                try:
                    sample = pd.to_datetime(raw[col].dropna().head(10), errors="coerce")
                    if sample.notna().sum() >= 5:
                        date_col = col
                        break
                except Exception:
                    continue
        if date_col is None:
            print(f"  [{sheet}] No date column found - skipping.")
            continue

        # Detect quantity column
        qty_col = None
        for col in raw.columns:
            col_lower = str(col).strip().lower()
            if col_lower in ("#", "qty", "quantity", "count", "total", "items"):
                qty_col = col
                break
        if qty_col is None:
            for col in raw.columns:
                if col == date_col:
                    continue
                if pd.api.types.is_numeric_dtype(raw[col]):
                    qty_col = col
                    break
        if qty_col is None:
            print(f"  [{sheet}] No quantity column found - skipping.")
            continue

        # Detect item type column
        type_col = None
        for col in raw.columns:
            col_lower = str(col).strip().lower()
            if col_lower in ("item type", "type", "category", "item_type"):
                type_col = col
                break

        df = pd.DataFrame()
        df["date"]     = pd.to_datetime(raw[date_col], errors="coerce")
        df["quantity"] = pd.to_numeric(raw[qty_col], errors="coerce").fillna(0).astype(int)
        df["raw_type"] = raw[type_col].astype(str) if type_col else "Other"

        df = df.dropna(subset=["date"])
        df = df[df["date"] >= pd.Timestamp("2024-01-01")]
        df = df[df["quantity"] > 0]

        df["category"] = df["raw_type"].apply(map_fcc_category)
        frames.append(df[["date", "category", "quantity"]])
        print(
            f"  [{sheet}] {len(df):,} usable rows  |  "
            f"date range: {df['date'].min().date()} -> {df['date'].max().date()}  |  "
            f"categories: {sorted(df['category'].unique())}"
        )

    if not frames:
        sys.exit("ERROR: No usable data found in the Excel file.")

    combined = pd.concat(frames, ignore_index=True).sort_values("date").reset_index(drop=True)
    return combined


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _get_or_create_fcc_items(
    db: Session,
    bank_id: int,
    categories: List[str],
    dry_run: bool,
) -> Dict[str, int]:
    """
    Return {category: item_id} for synthetic FCC Import items.

    Creates any missing items (name = "FCC Import - {category}") if not
    already present.  These are placeholder items that satisfy the FK
    constraint on inventory_movement; the forecasting extractor joins to
    inventory.category (which is set to the canonical name).
    """
    category_to_item: Dict[str, int] = {}

    for cat in categories:
        item_name = f"FCC Import - {cat}"
        existing = (
            db.query(InventoryItem)
            .filter(
                InventoryItem.bank_id == bank_id,
                InventoryItem.name == item_name,
            )
            .first()
        )
        if existing:
            category_to_item[cat] = existing.item_id
        else:
            if dry_run:
                # Use a placeholder negative ID so the rest of the dry-run logic works
                category_to_item[cat] = -(len(category_to_item) + 1)
                print(f"    [DRY RUN] Would create inventory item: {item_name!r}")
            else:
                new_item = InventoryItem(
                    bank_id=bank_id,
                    name=item_name,
                    category=cat,
                    quantity=0,
                    unit="items",
                )
                db.add(new_item)
                db.flush()  # populate item_id without committing
                category_to_item[cat] = new_item.item_id
                print(f"    Created inventory item: {item_name!r}  (id={new_item.item_id})")

    return category_to_item


# ---------------------------------------------------------------------------
# Main import function
# ---------------------------------------------------------------------------

def import_fcc(
    bank_id: int,
    data_path: Optional[Path],
    dry_run: bool,
    reset: bool,
) -> None:
    df = load_fcc_data(data_path)

    print(f"\nTotal rows to import: {len(df):,}")
    print(f"Date range           : {df['date'].min().date()} -> {df['date'].max().date()}")
    print(f"Categories           : {sorted(df['category'].unique())}")
    print(f"Total quantity       : {df['quantity'].sum():,} items")
    if dry_run:
        print("\n[DRY RUN - no database writes]\n")

    # Category distribution
    print("\nPer-category breakdown:")
    for cat, grp in df.groupby("category"):
        print(f"  {cat:<35} {len(grp):>5} rows  |  {grp['quantity'].sum():>6} items total")

    db: Session = SessionLocal()
    try:
        if reset:
            deleted = db.execute(
                text("""
                    DELETE FROM inventory_movement
                    WHERE reason = 'FCC_IMPORT'
                      AND item_id IN (
                          SELECT item_id FROM inventory WHERE bank_id = :bank_id
                      )
                """),
                {"bank_id": bank_id},
            ).rowcount
            if not dry_run:
                db.commit()
            print(
                f"\n{'[DRY RUN] Would delete' if dry_run else 'Deleted'} "
                f"{deleted} existing FCC_IMPORT rows for bank {bank_id}."
            )

        categories = df["category"].unique().tolist()
        print(f"\nResolving synthetic inventory items for bank {bank_id}...")
        cat_to_item = _get_or_create_fcc_items(db, bank_id, categories, dry_run)
        if not dry_run:
            db.flush()

        # Build movement objects
        movements: List[InventoryMovement] = []
        for _, row in df.iterrows():
            cat = row["category"]
            item_id = cat_to_item[cat]
            if item_id < 0:
                continue  # dry-run placeholder

            # Attach timezone info so SQLAlchemy stores a proper timestamptz
            created_at = row["date"].to_pydatetime().replace(tzinfo=timezone.utc)

            movements.append(
                InventoryMovement(
                    item_id=item_id,
                    quantity_change=-abs(int(row["quantity"])),  # negative = outflow
                    quantity_after=None,
                    movement_type=MovementType.OUTBOUND,
                    reason="FCC_IMPORT",
                    created_at=created_at,
                )
            )

        insert_count = len(df) if dry_run else len(movements)
        print(f"\n{'[DRY RUN] Would insert' if dry_run else 'Inserting'} "
              f"{insert_count:,} OUTBOUND movement rows...")

        if not dry_run:
            db.bulk_save_objects(movements)
            db.commit()
            print("Done.  Import committed successfully.")
            print(
                "\nNext step: trigger a forecast run to train on this data:\n"
                "  POST /forecasts/run  (or run pipeline.py directly)"
            )
        else:
            # In dry-run, movements list has all real rows (item_id was skipped for placeholders)
            # Show a sample
            print(f"\nSample rows (first 5):")
            for _, row in df.head(5).iterrows():
                print(
                    f"  {row['date'].date()}  {row['category']:<35} "
                    f"qty={row['quantity']}  movement=OUTBOUND  reason=FCC_IMPORT"
                )
            print("\n[DRY RUN complete - no changes written]")

    except Exception as exc:
        db.rollback()
        raise
    finally:
        db.close()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Import FCC distribution data into inventory_movement as OUTBOUND records."
    )
    p.add_argument(
        "--data",
        metavar="PATH",
        help="Path to the FCC Excel file. Auto-detected if omitted.",
    )
    p.add_argument(
        "--bank-id",
        type=int,
        default=1,
        metavar="INT",
        help="Target food bank ID (default: 1).",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview import without writing to the database.",
    )
    p.add_argument(
        "--reset",
        action="store_true",
        help="Delete all existing FCC_IMPORT movements for this bank before re-importing.",
    )
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    import_fcc(
        bank_id=args.bank_id,
        data_path=Path(args.data) if args.data else None,
        dry_run=args.dry_run,
        reset=args.reset,
    )
