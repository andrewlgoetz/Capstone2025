# main.py
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.api import inventory_routes, barcode_routes, auth_routes
from app.models import *
from app.services.auth_service import get_current_user

app = FastAPI(title="Inventory Management API")

# Allowed origins 
origins = [
    "http://localhost:5173",   # React dev server (Vite)
    "http://localhost:5174",
    "http://127.0.0.1:5173",   # sometimes needed too
    "http://127.0.0.1:5174",
    "*",  # <--- insecure but allows mobile connection (change later)
    # "https://your-deployed-frontend.com",  # add prod later
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
app.include_router(auth_routes.router, tags=["Auth"])
app.include_router(
    inventory_routes.router,
    tags=["Inventory"],
    dependencies=[Depends(get_current_user)],
)
app.include_router(
    barcode_routes.router,
    dependencies=[Depends(get_current_user)],
)


@app.get("/", dependencies=[Depends(get_current_user)])
def root():
    return {"message": "Inventory Management API running!"}
