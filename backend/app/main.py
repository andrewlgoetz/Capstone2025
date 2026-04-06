# main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import inventory_routes, barcode_routes, category_routes, auth_routes, location_routes, activity_log_routes, checkout_routes, checkin_routes, dietary_routes, bootstrap_routes
from app.api import forecast_routes
from app.models import *

app = FastAPI(title="Inventory Management API")

# Allowed origins: always include local dev servers.
# Add production/mobile origins via CORS_ORIGINS env var (comma-separated).
# Example: CORS_ORIGINS=https://app.myfoodbank.org,exp://192.168.1.10:8081
_extra_origins = [
    o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()
]
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    *_extra_origins,
]

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_routes.router, tags=["Authentication"])
app.include_router(inventory_routes.router, tags=["Inventory"])
app.include_router(barcode_routes.router)
app.include_router(category_routes.router)
app.include_router(location_routes.router)
app.include_router(activity_log_routes.router)
app.include_router(checkout_routes.router)
app.include_router(checkin_routes.router)
app.include_router(dietary_routes.router)
app.include_router(forecast_routes.router)
app.include_router(bootstrap_routes.router)

@app.get("/")
def root():
    return {"message": "Inventory Management API running!"}
