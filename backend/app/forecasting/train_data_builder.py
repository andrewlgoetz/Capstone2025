import warnings
warnings.filterwarnings("ignore")

from datasets import load_dataset
import pandas as pd

dataset = load_dataset("Dingdong-Inc/FreshRetailNet-50K")

df_train = dataset["train"].to_pandas()
df_eval = dataset["eval"].to_pandas()

df = pd.concat([df_train, df_eval], ignore_index=True)

df["dt"] = pd.to_datetime(df["dt"])

category_ts = (
    df.groupby(["dt", "third_category_id"], as_index=False)
      .agg({
          "sale_amount": "sum",
          "avg_temperature": "mean",
          "precpt": "mean",
          "holiday_flag": "max"
      })
)

print(df.columns)