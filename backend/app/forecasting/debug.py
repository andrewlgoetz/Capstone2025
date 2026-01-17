from app.database import get_db
from app.forecasting.data_extractions import extract_demand_forecast_data, DemandForecast

def main():
    db = next(get_db())

    # Bank-level (recommended v1)
    df = extract_demand_forecast_data(
        db=db,
        config=DemandForecast(group_by_location=False)
    )
    # print(df.head(30))
    print("rows:", len(df))
    print("cols:", df.columns.tolist())

    # Location-level (optional)
    df_loc = extract_demand_forecast_data(
        db=db,
        config=DemandForecast(group_by_location=True, location_source="movement")
    )
    print(df_loc)

if __name__ == "__main__":
    main()
