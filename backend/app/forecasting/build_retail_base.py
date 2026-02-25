from datasets import load_dataset
import pandas as pd

# 1. Load dataset
dataset = load_dataset("Dingdong-Inc/FreshRetailNet-50K")

df_train = dataset["train"].to_pandas()
df_eval = dataset["eval"].to_pandas()

df = pd.concat([df_train, df_eval], ignore_index=True)

# 2. Keep only needed columns
df = df[
    [
        "dt",
        "third_category_id",
        "sale_amount",
        "avg_temperature",
        "precpt",
        "holiday_flag"
    ]
]

# 3. Clean date
df["dt"] = pd.to_datetime(df["dt"])

# 4. Aggregate by date + category
retail_ts = (
    df.groupby(["dt", "third_category_id"], as_index=False)
      .agg({
          "sale_amount": "sum",
          "avg_temperature": "mean",
          "precpt": "mean",
          "holiday_flag": "max"
      })
)

# 5. Rename columns
retail_ts = retail_ts.rename(columns={
    "dt": "date",
    "third_category_id": "retail_category",
    "sale_amount": "distributed_qty",
    "precpt": "precipitation",
    "holiday_flag": "is_holiday"
})

# 6. Save
retail_ts.to_csv("backend/app/forecasting/data/processed/retail_category_ts.csv", index=False)

print("Retail base time series built.")