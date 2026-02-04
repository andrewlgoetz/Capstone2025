import pandas as pd

def find_header_row(raw: pd.DataFrame) -> int:
    for i in range(min(len(raw), 200)):
        row = raw.iloc[i].tolist()

        # convert every cell to a safe uppercase string
        row_str = [("" if pd.isna(x) else str(x)).upper() for x in row]

        if any("DATE" in c for c in row_str) and any("DESIGNATION" in c for c in row_str):
            return i

    raise ValueError("Could not find header row containing DATE and DESIGNATION")

def fill_missing_dates(df: pd.DataFrame, group_cols: list[str]) -> pd.DataFrame:
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"]).dt.date

    out = []
    for keys, g in df.groupby(group_cols, dropna=False):
        g = g.sort_values("date")
        min_d = pd.to_datetime(g["date"].min())
        max_d = pd.to_datetime(g["date"].max())
        full_dates = pd.date_range(min_d, max_d, freq="D").date

        base = pd.DataFrame({"date": full_dates})
        if not isinstance(keys, tuple):
            keys = (keys,)
        for col, val in zip(group_cols, keys):
            base[col] = val

        merged = base.merge(g, on=group_cols + ["date"], how="left")
        merged["demand_qty"] = merged["demand_qty"].fillna(0).astype(int)
        out.append(merged)

    return pd.concat(out, ignore_index=True)

def main():
    excel_path = "2025-2026 Suivi des Dons.xlsx"
    out_csv = "donations_timeseries.csv"

    raw = pd.read_excel(excel_path, sheet_name=0, header=None)
    header_row = find_header_row(raw)

    df = pd.read_excel(excel_path, sheet_name=0, header=header_row)

    # keep only columns we need
    df = df[["DATE", "DESIGNATION", "QTÉ KG"]].copy()

    # rename to match pipeline
    df = df.rename(columns={
        "DATE": "date",
        "DESIGNATION": "item_id",
        "QTÉ KG": "demand_qty",
    })

    df["bank_id"] = 1
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["item_id"] = df["item_id"].astype(str).str.strip()
    df["demand_qty"] = pd.to_numeric(df["demand_qty"], errors="coerce").fillna(0).astype(int)

    # drop bad dates then aggregate daily
    df = df.dropna(subset=["date"])
    df["date"] = df["date"].dt.date
    df = df.groupby(["bank_id", "item_id", "date"], as_index=False)["demand_qty"].sum()

    # fill missing dates so lags represent real days
    df = fill_missing_dates(df, group_cols=["bank_id", "item_id"])

    df.to_csv(out_csv, index=False)
    print(f"Saved {out_csv} with shape {df.shape}")

if __name__ == "__main__":
    main()