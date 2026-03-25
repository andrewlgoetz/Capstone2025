"""
Model Evaluation Script — FCC Real Distribution Data
=====================================================

Loads the FCC Excel workbook, parses distribution sessions into ISO-weekly
time series per category, then runs an expanding-window backtest for each
of four models:

  1. NaiveMean   — 4-week rolling mean (required baseline)
  2. ETS         — Holt-Winters exponential smoothing (statsmodels)
  3. CrostonTSB  — Teunter-Syntetos-Babai for intermittent series
  4. ARIMA       — ARIMA(p,d,q) via statsmodels; order chosen by AIC

Metrics reported at each horizon h ∈ {1, 2, 4} and as an average:
  MAE   — mean absolute error (in original units, items/week)
  WAPE  — weighted absolute percentage error  [handles zero actuals]
  MASE  — mean absolute scaled error vs. naive random-walk baseline

Usage
-----
  cd backend
  python eval_models_fcc.py [--data PATH_TO_XLSX] [--min-train 8] [--horizons 1,2,4]

Defaults:
  --data      Searches common paths for the FCC Excel file automatically.
  --min-train 8   (weeks required before starting the expanding window)
  --horizons  1,2,4
"""

from __future__ import annotations

import argparse
import sys
import warnings
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# FCC Item Type -> aggregate category mapping
# (mirrors the plan's Section M mapping table)
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
    # Meat
    "PROTEINS + ALTERNATIVES":                    "Meat & Seafood",
    "PROTEINS":                                   "Meat & Seafood",
    "PROTEIN":                                    "Meat & Seafood",
    # Produce
    "FRUITS + VEGETABLES":                        "Fresh Produce",
    "FRUITS AND VEGETABLES":                      "Fresh Produce",
    "FRUITS & VEGETABLES":                        "Fresh Produce",
    "PRODUCE":                                    "Fresh Produce",
    # Personal Care -> Other (no dedicated PC category in FCC data)
    "HYGIENE":                                    "Other",
    "TOILETRIES":                                 "Other",
    "HYGIENE, TOILETRIES":                        "Other",
    "PERSONAL CARE":                              "Other",
    # Dairy / Refrigerated
    "DAIRY":                                      "Dairy & Eggs",
    "DAIRY, REFRIGERATED/FROZEN GOODS":           "Dairy & Eggs",
    "REFRIGERATED/FROZEN GOODS":                  "Dairy & Eggs",
    "REFRIGERATED":                               "Dairy & Eggs",
}

# Fallback: keyword scan when exact match fails
FCC_KEYWORD_MAP: list[tuple[str, str]] = [
    ("grain",    "Grains & Pasta"),
    ("pasta",    "Grains & Pasta"),
    ("rice",     "Grains & Pasta"),
    ("bread",    "Grains & Pasta"),
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
    if not raw or pd.isna(raw):
        return "Other"
    cleaned = str(raw).strip().upper()
    if cleaned in FCC_CATEGORY_MAP:
        return FCC_CATEGORY_MAP[cleaned]
    lower = cleaned.lower()
    for keyword, cat in FCC_KEYWORD_MAP:
        if keyword in lower:
            return cat
    return "Other"


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def _find_fcc_file() -> Optional[Path]:
    """Try common locations for the FCC Excel file."""
    candidates = [
        Path(__file__).parent / "FCC Data – Inventory Tracking System Project (2024-2026).xlsx",
        Path(__file__).parent / "FCC_Data.xlsx",
        Path.home() / "Downloads" / "FCC Data – Inventory Tracking System Project (2024-2026).xlsx",
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
        date         — distribution date (datetime)
        category     — canonical aggregate category name
        quantity     — number of items distributed (int)
    """
    if path is None:
        path = _find_fcc_file()
    if path is None or not Path(path).exists():
        sys.exit(
            "ERROR: FCC Excel file not found. Pass --data PATH_TO_XLSX or place the file in "
            "the backend/ directory.\n"
            f"Looked in: {[str(c) for c in [Path(__file__).parent, Path.home() / 'Downloads']]}"
        )

    print(f"Loading: {path}")
    xl = pd.ExcelFile(path)
    print(f"  Sheets: {xl.sheet_names}")

    frames: list[pd.DataFrame] = []

    for sheet in xl.sheet_names:
        raw = xl.parse(sheet, header=0)

        # ── Detect date column ──────────────────────────────────────────────
        date_col = None
        for col in raw.columns:
            col_lower = str(col).strip().lower()
            if col_lower in ("date", "session date", "distribution date", "week"):
                date_col = col
                break
        if date_col is None:
            # Try the first column that parses as dates
            for col in raw.columns[:3]:
                try:
                    sample = pd.to_datetime(raw[col].dropna().head(10), errors="coerce")
                    if sample.notna().sum() >= 5:
                        date_col = col
                        break
                except Exception:
                    continue
        if date_col is None:
            print(f"  [{sheet}] No date column found — skipping.")
            continue

        # ── Detect quantity column ──────────────────────────────────────────
        qty_col = None
        for col in raw.columns:
            col_lower = str(col).strip().lower()
            if col_lower in ("#", "qty", "quantity", "count", "total", "items"):
                qty_col = col
                break
        if qty_col is None:
            # Fall back to first numeric column after date
            for col in raw.columns:
                if col == date_col:
                    continue
                if pd.api.types.is_numeric_dtype(raw[col]):
                    qty_col = col
                    break
        if qty_col is None:
            print(f"  [{sheet}] No quantity column found — skipping.")
            continue

        # ── Detect item type column ─────────────────────────────────────────
        type_col = None
        for col in raw.columns:
            col_lower = str(col).strip().lower()
            if col_lower in ("item type", "type", "category", "item_type"):
                type_col = col
                break

        # ── Parse ───────────────────────────────────────────────────────────
        df = pd.DataFrame()
        df["date"]     = pd.to_datetime(raw[date_col], errors="coerce")
        df["quantity"] = pd.to_numeric(raw[qty_col], errors="coerce").fillna(0).astype(int)
        df["raw_type"] = raw[type_col].astype(str) if type_col else "Other"

        df = df.dropna(subset=["date"])
        df = df[df["date"] >= pd.Timestamp("2024-01-01")]
        df = df[df["quantity"] > 0]

        df["category"] = df["raw_type"].apply(map_fcc_category)
        frames.append(df[["date", "category", "quantity"]])
        print(f"  [{sheet}] {len(df):,} usable rows  |  "
              f"date range: {df['date'].min().date()} -> {df['date'].max().date()}  |  "
              f"categories: {sorted(df['category'].unique())}")

    if not frames:
        sys.exit("ERROR: No usable data found in the Excel file.")

    combined = pd.concat(frames, ignore_index=True)
    return combined


def build_weekly_series(df: pd.DataFrame) -> dict[str, pd.Series]:
    """
    Aggregate raw records into ISO-weekly time series per category + aggregate.

    Returns a dict: category_name -> pd.Series(DatetimeIndex, float)
    The 'TOTAL' key holds the bank-level aggregate across all categories.
    """
    df = df.copy()
    df["week_start"] = df["date"].apply(
        lambda d: pd.Timestamp(d.date() - pd.Timedelta(days=d.weekday()))
    )

    weekly = (
        df.groupby(["category", "week_start"])["quantity"]
        .sum()
        .reset_index()
    )

    all_weeks = pd.date_range(
        start=df["week_start"].min(),
        end=df["week_start"].max(),
        freq="W-MON",
    )

    series_map: dict[str, pd.Series] = {}
    for cat in weekly["category"].unique():
        cat_df = (
            weekly[weekly["category"] == cat]
            .set_index("week_start")["quantity"]
            .astype(float)
        )
        series_map[cat] = cat_df.reindex(all_weeks, fill_value=0.0)

    # Bank-level aggregate (sum across all categories)
    total = pd.Series(0.0, index=all_weeks)
    for s in series_map.values():
        total = total.add(s, fill_value=0.0)
    series_map["TOTAL"] = total

    return series_map


# ---------------------------------------------------------------------------
# Model implementations (standalone — no app imports required)
# ---------------------------------------------------------------------------

class NaiveMean:
    name = "NaiveMean"

    def __init__(self, window: int = 4):
        self.window = window
        self._mean = 0.0

    def fit(self, series: pd.Series) -> None:
        self._mean = max(0.0, float(series.tail(self.window).mean()))

    def predict(self, steps: int) -> np.ndarray:
        return np.full(steps, self._mean)


class ETSModel:
    name = "ETS"

    def __init__(self):
        self._result = None
        self._n = 0

    def fit(self, series: pd.Series) -> None:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        self._n = len(series)
        values = series.values.astype(float)
        trend = "add" if self._n >= 12 else None
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            self._result = ExponentialSmoothing(
                values,
                trend=trend,
                damped_trend=(trend is not None),
                seasonal=None,
                initialization_method="estimated",
            ).fit(optimized=True, remove_bias=True)

    def predict(self, steps: int) -> np.ndarray:
        raw = self._result.forecast(steps)
        return np.clip(raw, 0, None)


class CrostonTSB:
    name = "CrostonTSB"

    def __init__(self):
        self.alpha1 = 0.2
        self.alpha2 = 0.3
        self._p = 0.5
        self._z = 1.0

    @staticmethod
    def _run(values: np.ndarray, a1: float, a2: float) -> Tuple[float, float, np.ndarray]:
        n = len(values)
        nz = values[values > 0]
        p = float((values > 0).mean()) if n > 0 else 0.5
        z = float(nz.mean()) if len(nz) > 0 else 1.0
        fitted = np.empty(n)
        for t in range(n):
            fitted[t] = p * z
            if values[t] > 0:
                p = (1 - a1) * p + a1
                z = (1 - a2) * z + a2 * float(values[t])
            else:
                p = (1 - a1) * p
        return p, z, fitted

    def fit(self, series: pd.Series) -> None:
        from scipy.optimize import minimize
        values = series.values.astype(float)

        def sse(params):
            a1, a2 = float(params[0]), float(params[1])
            _, _, fitted = self._run(values, a1, a2)
            return float(np.sum((values - fitted) ** 2))

        res = minimize(sse, [self.alpha1, self.alpha2], method="L-BFGS-B",
                       bounds=[(0.05, 0.95), (0.05, 0.95)])
        self.alpha1, self.alpha2 = float(res.x[0]), float(res.x[1])
        self._p, self._z, _ = self._run(values, self.alpha1, self.alpha2)

    def predict(self, steps: int) -> np.ndarray:
        return np.full(steps, max(0.0, self._p * self._z))


class ARIMAModel:
    name = "ARIMA"
    # Candidate orders to try; select by lowest AIC
    _ORDERS = [(0, 1, 0), (0, 1, 1), (1, 1, 0), (1, 1, 1), (0, 0, 1), (1, 0, 0)]

    def __init__(self):
        self._result = None

    def fit(self, series: pd.Series) -> None:
        from statsmodels.tsa.arima.model import ARIMA
        values = series.values.astype(float)
        # Tiny positive offset prevents log(0) issues inside statsmodels
        values = np.where(values == 0, 0.01, values)

        best_aic = np.inf
        best_result = None
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            for order in self._ORDERS:
                try:
                    res = ARIMA(values, order=order).fit()
                    if res.aic < best_aic:
                        best_aic = res.aic
                        best_result = res
                except Exception:
                    continue
        self._result = best_result

    def predict(self, steps: int) -> np.ndarray:
        if self._result is None:
            return np.zeros(steps)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            fc = self._result.forecast(steps=steps)
        return np.clip(fc, 0, None)


ALL_MODELS = [NaiveMean, ETSModel, CrostonTSB, ARIMAModel]


# ---------------------------------------------------------------------------
# Expanding-window backtest
# ---------------------------------------------------------------------------

def backtest(
    series: pd.Series,
    model_cls,
    min_train: int = 8,
    horizons: List[int] = None,
) -> Optional[Dict]:
    """
    Expanding-window backtest for a single (series, model) pair.

    Returns a dict with per-horizon and aggregate metrics, or None when
    there are too few observations to produce at least 4 evaluation steps.
    """
    if horizons is None:
        horizons = [1, 2, 4]

    n = len(series)
    if n < min_train + 4:
        return None

    values = series.values.astype(float)
    errors: Dict[int, List[Tuple[float, float]]] = {h: [] for h in horizons}

    for t in range(min_train, n):
        train = series.iloc[:t]
        try:
            m = model_cls()
            m.fit(train)
            preds = m.predict(steps=max(horizons))
        except Exception:
            continue

        for h in horizons:
            future_idx = t + h - 1
            if future_idx < n:
                actual = float(values[future_idx])
                pred   = max(0.0, float(preds[h - 1]))
                errors[h].append((actual, pred))

    # Naive MAE for MASE denominator (one-step random walk on initial training window)
    naive_diffs = np.abs(np.diff(values[:min_train]))
    naive_mae = float(np.mean(naive_diffs)) if len(naive_diffs) > 0 and np.mean(naive_diffs) > 0 else 1.0

    result: Dict = {"model": model_cls.name, "n_train_weeks": n}
    mae_list, wape_list, mase_list = [], [], []

    for h in horizons:
        pairs = errors[h]
        if not pairs:
            continue
        actuals = np.array([p[0] for p in pairs])
        preds   = np.array([p[1] for p in pairs])
        abs_err = np.abs(actuals - preds)

        mae  = float(np.mean(abs_err))
        wape = float(np.sum(abs_err) / np.sum(actuals)) if np.sum(actuals) > 0 else None
        mase = mae / naive_mae

        result[f"MAE_h{h}"]  = round(mae,  2)
        result[f"WAPE_h{h}"] = round(wape, 4) if wape is not None else None
        result[f"MASE_h{h}"] = round(mase, 4)

        mae_list.append(mae)
        if wape is not None: wape_list.append(wape)
        mase_list.append(mase)

    if mae_list:
        result["MAE_avg"]  = round(float(np.mean(mae_list)),  2)
        result["WAPE_avg"] = round(float(np.mean(wape_list)), 4) if wape_list else None
        result["MASE_avg"] = round(float(np.mean(mase_list)), 4)

    return result


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def _pct(v) -> str:
    if v is None:
        return "   n/a "
    return f"{v * 100:6.1f}%"


def _fmt(v) -> str:
    if v is None:
        return "    n/a"
    return f"{v:7.2f}"


def print_report(all_results: Dict[str, List[Optional[Dict]]], horizons: List[int]) -> None:
    """Print a formatted comparison table of all models × all categories."""

    h_cols = [f"h={h}" for h in horizons] + ["avg"]

    print("\n" + "=" * 90)
    print("FCC DATA — MODEL EVALUATION REPORT")
    print("=" * 90)

    for category, model_results in sorted(all_results.items()):
        valid = [r for r in model_results if r is not None]
        if not valid:
            print(f"\n[{category}]  INSUFFICIENT DATA (skipped all models)")
            continue

        n_weeks = valid[0]["n_train_weeks"]
        print(f"\n[{category}]  {n_weeks} weeks of data")

        # MAE table
        print(f"  {'Model':<14}  {'MAE':>9}  " + "  ".join(f"MAE {c:>5}" for c in h_cols))
        for r in model_results:
            if r is None:
                continue
            name = r["model"]
            vals = [r.get(f"MAE_h{h}") for h in horizons] + [r.get("MAE_avg")]
            print(f"  {name:<14}  " + "  ".join(_fmt(v) for v in vals))

        # WAPE table
        print(f"  {'Model':<14}  {'WAPE':>9}  " + "  ".join(f"WAPE{c:>5}" for c in h_cols))
        for r in model_results:
            if r is None:
                continue
            name = r["model"]
            vals = [r.get(f"WAPE_h{h}") for h in horizons] + [r.get("WAPE_avg")]
            print(f"  {name:<14}  " + "  ".join(_pct(v) for v in vals))

        # MASE table
        print(f"  {'Model':<14}  {'MASE':>9}  " + "  ".join(f"MASE{c:>5}" for c in h_cols))
        for r in model_results:
            if r is None:
                continue
            name = r["model"]
            vals = [r.get(f"MASE_h{h}") for h in horizons] + [r.get("MASE_avg")]
            print(f"  {name:<14}  " + "  ".join(_fmt(v) for v in vals))

    # Summary: avg WAPE across all categories (excluding TOTAL)
    print("\n" + "-" * 90)
    print("SUMMARY — average WAPE across all categories (excluding TOTAL)")
    print(f"  {'Model':<14}  " + "  ".join(f"WAPE{c:>5}" for c in h_cols))

    for model_cls in ALL_MODELS:
        mname = model_cls.name
        col_vals = {h: [] for h in horizons}
        avg_vals = []
        for cat, results in all_results.items():
            if cat == "TOTAL":
                continue
            for r in results:
                if r is None or r.get("model") != mname:
                    continue
                for h in horizons:
                    v = r.get(f"WAPE_h{h}")
                    if v is not None:
                        col_vals[h].append(v)
                if r.get("WAPE_avg") is not None:
                    avg_vals.append(r["WAPE_avg"])

        row_vals = [
            (float(np.mean(col_vals[h])) if col_vals[h] else None)
            for h in horizons
        ] + [(float(np.mean(avg_vals)) if avg_vals else None)]
        print(f"  {mname:<14}  " + "  ".join(_pct(v) for v in row_vals))

    print("=" * 90)
    print("\nNotes:")
    print("  WAPE = sum(|actual-forecast|) / sum(actual)  [lower is better; handles zeros]")
    print("  MASE < 1.0 means the model beats the naive random-walk baseline")
    print("  ARIMA on 19 weeks is expected to perform similarly to NaiveMean or ETS")
    print("  (ARIMA order selection by AIC from candidates: " +
          ", ".join(str(o) for o in ARIMAModel._ORDERS) + ")")


def export_csv(all_results: Dict[str, List[Optional[Dict]]], horizons: List[int], out_path: Path) -> None:
    """Write the full results table to a CSV for further analysis."""
    rows = []
    for cat, model_results in all_results.items():
        for r in model_results:
            if r is None:
                continue
            row = {"category": cat, "model": r["model"], "n_weeks": r["n_train_weeks"]}
            for h in horizons:
                row[f"MAE_h{h}"]  = r.get(f"MAE_h{h}")
                row[f"WAPE_h{h}"] = r.get(f"WAPE_h{h}")
                row[f"MASE_h{h}"] = r.get(f"MASE_h{h}")
            row["MAE_avg"]  = r.get("MAE_avg")
            row["WAPE_avg"] = r.get("WAPE_avg")
            row["MASE_avg"] = r.get("MASE_avg")
            rows.append(row)

    if rows:
        pd.DataFrame(rows).to_csv(out_path, index=False)
        print(f"\nResults exported to: {out_path}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Evaluate forecasting models on FCC data")
    parser.add_argument("--data",       type=Path, default=None,
                        help="Path to FCC Excel file (auto-detected if omitted)")
    parser.add_argument("--min-train",  type=int,  default=8,
                        help="Minimum training weeks before starting backtest (default: 8)")
    parser.add_argument("--horizons",   type=str,  default="1,2,4",
                        help="Comma-separated forecast horizons in weeks (default: 1,2,4)")
    parser.add_argument("--out",        type=Path, default=None,
                        help="Optional path to write results CSV")
    args = parser.parse_args()

    horizons = [int(h) for h in args.horizons.split(",")]

    # ── Load & aggregate ────────────────────────────────────────────────────
    df = load_fcc_data(args.data)
    print(f"\nTotal usable rows: {len(df):,}")
    print(f"Date range: {df['date'].min().date()} -> {df['date'].max().date()}")
    print(f"Categories found: {sorted(df['category'].unique())}")

    series_map = build_weekly_series(df)
    print(f"\nWeekly series built: {len(series_map)} (including TOTAL aggregate)")
    for cat, s in sorted(series_map.items()):
        nonzero = int((s > 0).sum())
        print(f"  {cat:<35}  {len(s):>2} weeks  ({nonzero} non-zero)  "
              f"mean={s.mean():.1f}  max={s.max():.0f}")

    # ── Backtest each model on each series ──────────────────────────────────
    all_results: Dict[str, List[Optional[Dict]]] = {}

    for cat, series in sorted(series_map.items()):
        print(f"\nBacktesting [{cat}] ({len(series)} weeks)…")
        cat_results = []
        for model_cls in ALL_MODELS:
            r = backtest(series, model_cls, min_train=args.min_train, horizons=horizons)
            if r is None:
                print(f"  {model_cls.name:<14} — skipped (insufficient data)")
            else:
                wape_str = f"WAPE_avg={r.get('WAPE_avg', 0)*100:.1f}%" if r.get('WAPE_avg') is not None else "WAPE_avg=n/a"
                mase_str = f"MASE_avg={r.get('MASE_avg', 0):.3f}" if r.get('MASE_avg') is not None else ""
                print(f"  {model_cls.name:<14}  {wape_str}  {mase_str}")
            cat_results.append(r)
        all_results[cat] = cat_results

    # ── Report ──────────────────────────────────────────────────────────────
    print_report(all_results, horizons)

    if args.out:
        export_csv(all_results, horizons, args.out)
    else:
        default_out = Path(__file__).parent / "eval_results_fcc.csv"
        export_csv(all_results, horizons, default_out)


if __name__ == "__main__":
    main()
