
# Backend Setup Guide 

This document explains how to set up, run, and extend the backend for the project.

## Overview

**Stack Used:**
- **FastAPI** — Web framework
- **SQLAlchemy** — ORM (Object Relational Mapper)
- **Alembic** — Database migrations
- **PostgreSQL** — Database (Dockerized)
- **Pydantic** — Request/response data validation

---

## 1. Prerequisites

Make sure everyone has the following installed:

| Tool | Version | Purpose |
|------|----------|----------|
| Python | 3.10+ | Backend |
| Docker & Docker Compose | Latest | PostgreSQL container |
| Git | Any | Version control |
| VS Code | Recommended | Development |
| pgAdmin | Recommended | Visualize tables |

##  2. Set Up

```bash
docker compose up -d
```
This starts the PostgreSQL container on port 5432.

**Database Migrations (Alembic)**
Step 1 — Models (Database Tables)

All database tables are defined as Python classes inside the `backend/models/` folder.

Step 2 — Update backend/migrations/env.py

Make sure your models are imported so Alembic can detect them:
```python
from backend.database import Base
from backend.models import user, role, ...

target_metadata = Base.metadata
```
Step 3 — Generate and apply migrations
```python
alembic revision --autogenerate -m "migration message"
alembic upgrade head
```
This will create and apply database tables automatically.

Alembic compares your models with the current database and writes a migration file under:

```migrations/versions/<timestamp>migration message.py```

**Viewing Tables**

Option 1 — Using Docker

Enter the running PostgreSQL container:
```bash
docker exec -it inventory_db psql -U myuser -d inventory_db
```

Once inside, you can run:
```bash
\dt         -- list all tables
\d users    -- describe the 'users' table
SELECT * FROM users;  -- view table data
\q -- quit shell
```

Option 2 — Using a Database Client

You can also connect via pgAdmin or TablePlus with these credentials:
```
Host: localhost
Port: 5432
Database: inventory_db
Username: myuser
Password: mypassword
```
**Running the FastAPI App**

Step 1 — Install Dependencies
```bash
pip install -r requirements.txt
```

Step 2 — Run the App


```bash
cd backend
uvicorn app.main:app --reload   
```

The app will be available at:

http://127.0.0.1:8000

http://127.0.0.1:8000/docs (Swagger UI)

## 10. Common Commands

| Task | Command |
|----------|------------|
| **Start Database** | `docker compose up -d` |
| **Stop Database** | `docker compose down` |
| **Rebuild Database** | `docker compose down -v && docker compose up -d` |
| **Enter DB Shell** | `docker exec -it inventory_db psql -U myuser -d inventory_db` |
| **New Migration** | `alembic revision --autogenerate -m "message"` |
| **Apply Migration** | `alembic upgrade head` |
| **Rollback Migration** | `alembic downgrade -1` |
| **Run FastAPI** | `uvicorn backend.main:app --reload` |
