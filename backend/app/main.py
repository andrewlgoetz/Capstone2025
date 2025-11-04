# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import inventory_routes, barcode_routes

app = FastAPI(title="Inventory Management API")

# Allowed origins (edit as needed)
origins = [
    "http://localhost:5173",   # React dev server (Vite)
    "http://127.0.0.1:5173",   # sometimes needed too
    # "https://your-deployed-frontend.com",  # add prod later
]

# CORS middleware (add before traffic hits your routes)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,      # DO NOT use ["*"] with allow_credentials=True
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(inventory_routes.router, tags=["Inventory"])
app.include_router(barcode_routes.router)

@app.get("/")
def root():
    return {"message": "Inventory Management API running!"}
