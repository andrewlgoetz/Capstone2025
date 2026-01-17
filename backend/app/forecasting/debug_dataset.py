from app.database import get_db
from app.forecasting.dataset_builder import build_training_dataset

def main():
    db = next(get_db())
    df = build_training_dataset(db, group_by_location=False)
    print(df.head(30))
    print("rows:", len(df))
    print("cols:", df.columns.tolist())

if __name__ == "__main__":
    main()
