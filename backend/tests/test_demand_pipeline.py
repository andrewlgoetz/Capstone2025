# This test suite validates the core data cleaning and feature engineering logic of the demand forecasting pipeline.

import pytest
import pandas as pd
import numpy as np

# Simulating pipeline's core cleaning and feature engineering logic for testing purposes.
def mock_clean_data(df):
    df = df.dropna(subset=['date', 'quantity'])
    df = df[df['quantity'] >= 0] # Remove negative demand
    df['category'] = df['category'].fillna('Unknown')
    return df.reset_index(drop=True)

def mock_feature_engineering(df):
    df['date'] = pd.to_datetime(df['date'])
    df['month'] = df['date'].dt.month
    df['week'] = df['date'].dt.isocalendar().week
    
    # Feature Engineering: Perishable indicator
    perishables = ['Produce', 'Dairy', 'Meat']
    df['is_perishable'] = df['category'].isin(perishables).astype(int)
    return df

@pytest.fixture
def raw_historical_data():
    """Simulates messy database extraction with missing dates, negatives, and nulls."""
    return pd.DataFrame({
        'date': ['2025-01-01', '2025-01-02', None, '2025-01-04', '2025-12-25'],
        'item_id': [1, 2, 1, 3, 1],
        'category': ['Produce', 'Canned Goods', 'Produce', None, 'Produce'],
        'quantity': [50, -10, 20, 15, 100] # -10 is invalid demand
    })

# --- Data Cleaning and Formatting ---
def test_data_cleaning_removes_invalid_records(raw_historical_data):
    """Missing dates are handled and invalid negative demand is rejected."""
    cleaned_df = mock_clean_data(raw_historical_data)
    
    # Missing date row should be gone
    assert cleaned_df['date'].isna().sum() == 0
    
    # Negative quantity (-10) row should be gone
    assert (cleaned_df['quantity'] >= 0).all()
    assert len(cleaned_df) == 3 # 5 original - 1 missing date - 1 negative = 3

# --- Feature Engineering Validation ---
def test_feature_engineering_generation(raw_historical_data):
    """Date-based features and Perishable indicators are applied correctly."""
    cleaned_df = mock_clean_data(raw_historical_data)
    features_df = mock_feature_engineering(cleaned_df)
    
    # Date features generated
    assert 'month' in features_df.columns
    assert 'week' in features_df.columns
    assert features_df.loc[0, 'month'] == 1
    assert features_df.loc[2, 'month'] == 12 # Dec 25th row
    
    # Perishable logic applied correctly
    assert features_df.loc[0, 'is_perishable'] == 1 # Produce is perishable
    assert features_df.loc[1, 'is_perishable'] == 0 # Canned Goods is not

# --- Pipeline Consistency ---
def test_pipeline_consistency_and_determinism(raw_historical_data):
    """The pipeline produces deterministic outputs with identical dimensions."""
    cleaned_df = mock_clean_data(raw_historical_data)
    train_features = mock_feature_engineering(cleaned_df)
    
    # Test Determinism: Running it twice produces the exact same DataFrame
    train_features_run_2 = mock_feature_engineering(cleaned_df.copy())
    pd.testing.assert_frame_equal(train_features, train_features_run_2)

    # Test Dimension Consistency for Prediction 
    # (Simulating future data input missing the 'quantity' target)
    future_data = pd.DataFrame({
        'date': ['2026-01-01'],
        'item_id': [1],
        'category': ['Produce'],
        'quantity': [0] # Dummy target for transform logic
    })
    
    predict_features = mock_feature_engineering(mock_clean_data(future_data))
    
    # Feature columns must match exactly to prevent model crashing
    train_cols = [c for c in train_features.columns if c != 'quantity']
    predict_cols = [c for c in predict_features.columns if c != 'quantity']
    
    assert set(train_cols) == set(predict_cols)