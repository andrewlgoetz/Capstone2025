import os
from datetime import datetime
from typing import List, Tuple, Optional

import joblib
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sklearn.metrics import mean_absolute_error

from app.forecasting.data_extractions import extract_demand_forecast_data, DemandForecast
from app.forecasting.feature_engineering import (
	add_calendar_features,
	add_lag_features,
	add_rolling_features,
)

try:
	# Prefer xgboost if available; installation is required in the environment
	from xgboost import XGBRegressor
except Exception:  # pragma: no cover - import-time guard
	XGBRegressor = None


def build_training_dataset(
	db: Session,
	group_by_location: bool = False,
) -> pd.DataFrame:
	"""Builds a training dataset with features for demand forecasting.

	Returns a DataFrame with at least these columns:
	  - bank_id, item_id, (optionally location_id), date, demand_qty
	  - calendar & lag features created by the feature engineering helpers
	"""
	# 1) Pull base time series
	time_series = extract_demand_forecast_data(
		db=db,
		config=DemandForecast(group_by_location=group_by_location)
	)
	df = time_series.copy()

	group_cols = ["bank_id", "item_id"]
	if group_by_location:
		group_cols = ["bank_id", "location_id", "item_id"]
    
	# 2) Feature engineering
	df = add_calendar_features(df)
	df = add_lag_features(df, group_cols=group_cols, lags=[1, 7])
	df = add_rolling_features(df, group_cols=group_cols, windows=[7])

	return df


def _smape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
	denom = (np.abs(y_true) + np.abs(y_pred))
	# avoid division by zero
	mask = denom == 0
	denom[mask] = 1.0
	smape = 100.0 * np.mean(2.0 * np.abs(y_pred - y_true) / denom)
	return float(smape)


def _prepare_matrix(
	df: pd.DataFrame,
	feature_cols: List[str],
	categorical_cols: Optional[List[str]] = None,
) -> Tuple[np.ndarray, np.ndarray, pd.DataFrame]:
	"""Prepare X, y arrays for training. Returns (X, y, df_used).

	Categorical columns are label-encoded in-place and returned as integers.
	"""
	df = df.copy()
	required = ["demand_qty", "date"]
	missing = [c for c in required if c not in df.columns]
	if missing:
		raise ValueError(f"Missing required columns: {missing}")

	# Drop rows with NaNs in feature columns
	df = df.dropna(subset=feature_cols + ["demand_qty"]).reset_index(drop=True)

	if categorical_cols:
		for c in categorical_cols:
			# simple label encoding preserving unseen as -1
			df[c] = pd.factorize(df[c])[0]

	X = df[feature_cols].to_numpy(dtype=float)
	y = df["demand_qty"].to_numpy(dtype=float)
	return X, y, df


def time_train_test_split(df: pd.DataFrame, date_col: str = "date", test_days: int = 7) -> Tuple[pd.DataFrame, pd.DataFrame]:
	"""Split by date: last `test_days` days are test set (across all series).

	This is a simple holdout appropriate for initial evaluation.
	"""
	df = df.copy()
	df[date_col] = pd.to_datetime(df[date_col])
	max_date = df[date_col].max()
	cutoff = max_date - pd.Timedelta(days=test_days)
	train = df[df[date_col] <= cutoff].reset_index(drop=True)
	test = df[df[date_col] > cutoff].reset_index(drop=True)
	return train, test


def train_xgb(
	df: pd.DataFrame,
	feature_cols: List[str],
	categorical_cols: Optional[List[str]] = None,
	test_days: int = 7,
	model_dir: str = ".",
	model_name: str = "xgb_demand",
	random_state: int = 42,
	xgb_params: Optional[dict] = None,
) -> dict:
	"""Train a simple XGBoost regressor on the provided DataFrame.

	Saves the trained model to `model_dir/{model_name}.joblib` and returns a dict
	with metrics and paths.
	"""
	if XGBRegressor is None:
		raise RuntimeError("XGBoost is not installed in the environment.")

	train_df, test_df = time_train_test_split(df, test_days=test_days)

	X_train, y_train, train_df = _prepare_matrix(train_df, feature_cols, categorical_cols)
	X_test, y_test, test_df = _prepare_matrix(test_df, feature_cols, categorical_cols)

	params = xgb_params or {}
	# sensible defaults
	params.setdefault("n_estimators", 200)
	params.setdefault("learning_rate", 0.05)
	params.setdefault("max_depth", 6)
	params.setdefault("random_state", random_state)
	params.setdefault("verbosity", 0)

	model = XGBRegressor(**params)
	model.fit(X_train, y_train, eval_set=[(X_test, y_test)], early_stopping_rounds=20, verbose=False)

	preds = model.predict(X_test)
	mae = float(mean_absolute_error(y_test, preds))
	smape = _smape(y_test, preds)

	os.makedirs(model_dir, exist_ok=True)
	ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
	fname = f"{model_name}_{ts}.joblib"
	path = os.path.join(model_dir, fname)
	joblib.dump({"model": model, "feature_cols": feature_cols, "categorical_cols": categorical_cols}, path)

	return {
		"model_path": path,
		"mae": mae,
		"smape": smape,
		"n_train": len(y_train),
		"n_test": len(y_test),
	}


if __name__ == "__main__":  # pragma: no cover - convenience script
	# This block provides a small CLI-like convenience for local runs.
	import argparse
	from sqlalchemy import create_engine

	parser = argparse.ArgumentParser()
	parser.add_argument("--db-url", help="SQLAlchemy database URL for reading data")
	parser.add_argument("--model-dir", default="./models")
	parser.add_argument("--test-days", type=int, default=7)
	parser.add_argument("--group-by-location", action="store_true")
	args = parser.parse_args()

	if args.db_url is None:
		raise SystemExit("Please provide --db-url to read training data")

	engine = create_engine(args.db_url)
	with Session(engine) as session:  # type: ignore
		df = build_training_dataset(session, group_by_location=args.group_by_location)

	# Choose feature columns automatically: any column that starts with lag_ or rolling_ or calendar cols
	candidate_features = [c for c in df.columns if c.startswith("lag_") or c.startswith("rolling_") or c in ("day_of_week", "is_weekend", "month")]
	categorical = [c for c in ("bank_id", "item_id", "location_id") if c in df.columns]

	print(f"Training XGBoost on {len(df)} rows with features: {candidate_features}")
	res = train_xgb(
		df,
		feature_cols=candidate_features + categorical,
		categorical_cols=categorical,
		test_days=args.test_days,
		model_dir=args.model_dir,
		model_name="xgb_demand",
	)
	print(f"Done. saved to {res['model_path']}. MAE={res['mae']:.3f}, SMAPE={res['smape']:.2f} %")
