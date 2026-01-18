
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

First make sure the docker app is up and running then run:

```bash
docker compose up -d
```
This starts the PostgreSQL container on port 5432.

**Making Database Migrations (Alembic)**
Step 1 — Models (Database Tables)

All database tables are defined as Python classes inside the `backend/models/` folder. Make changes to the database here.

Step 2 — Update backend/migrations/env.py

Make sure your models are imported so Alembic can detect them:
```python
from backend.database import Base
from backend.models import user, role, ...

target_metadata = Base.metadata
```
Step 3 — Generate and apply migrations
```python
cd backend
alembic revision --autogenerate -m "migration message"
alembic upgrade head
```
This will create and apply database tables automatically.

Alembic compares your models with the current database and writes a migration file under:

```migrations/versions/<timestamp>migration message.py```

Commit both your code and the Alembic migration file when you make database changes :) 

To get the latest change, team members have to run both:

```
git pull
alembic upgrade head
```

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

## 3. Run Backend Unit Tests

With the dependencies installed you can execute the new pytest suite directly from the backend folder:

```bash
cd backend
pytest
```

This automatically discovers all tests under `backend/tests/` and uses the configuration defined in `backend/pytest.ini`.

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
| **Run FastAPI** | `cd backend ; uvicorn app.main:app --reload` |

---

# Frontend Setup Guide 

This document explains how to set up, run, and extend the frontend for the project.

## Overview

**Stack Used:**
- **React** — Javascript library 
- **Vite** — Build tool and dev server for React
- **Axios** — HTTP client for API requests
- **React Router DOM** — Routing for application

---

## 1. Prerequisites

Make sure everyone has the following installed:

| Tool | Version | Purpose |
|------|----------|----------|
| Node.js | 18+ | Frontend runtime |
| npm | 8+ | Package management |
| Git | Any | Version control |
| VS Code | Recommended | Development |

You can verify Node installation:
```bash
node -v
npm -v
```
If not installed, download Node.js from https://nodejs.org/. 

##  2. Set Up

1. Navigate to the frontend folder
```bash
cd frontend
```

2. Install dependencies
```bash
npm install
```

3. Run the dev server
```bash
npm run dev
```

The app will be available at:

http://localhost:5173

## 10. Common Commands

| Task | Command |
|----------|------------|
| **Run dev server** | `npm run dev` |
| **Build for prod** | `npm run build` |
| **Install dependencies** | `npm install` |

---

# Running Both Together

1. In one terminal:
```bash
cd backend
uvicorn app.main:app --reload
```

2. In another terminal:
```bash
cd frontend
npm run dev
```

Now
- Frontend runs at: http://localhost:5173
- Backend runs at: http://127.0.0.1:8000

# Mobile App Setup 

1. Run the Server (Public Mode):

To let the mobile app connect, you must listen on 0.0.0.0 (not just localhost).

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2. Download the Expo Go app on your phone (find it in the app store)

3. Navigate to the mobile folder:

```bash
cd mobile-inventory
```

Install dependencies:

```bash
npm install
```

4. Configure IP Address:

4.1 - Find your computer's local IP.

**Windows:** Open Command Prompt, type ipconfig. Look for IPv4 Address (e.g., 192.168.1.15).

**Mac/Linux:** Open Terminal, type ifconfig | grep "inet ". Look for the address like 192.168.x.x.

4.2 - Open mobile-inventory/app/index.tsx.

4.3 - Update const API_URL to match your IP:

```javascript
const API_URL = 'http://YOUR_IP';
```

5. Run the App:

```bash
npx expo start
```

6. Scan the QR code in the terminal with your phone. It'll open the expo go app to show you the app!!

NOTE: once the backend is hosted the steps will change to not be through local IP

