from fastapi import FastAPI
from app.api import inventory_routes, barcode_routes

app = FastAPI(title="Inventory Management API")

app.include_router(inventory_routes.router)
app.include_router(barcode_routes.router)

@app.get("/")
def root():
    return {"message": "Inventory Management API running!"}
