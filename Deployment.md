# Render Deployment Guide

This project is deployed to Render using a Blueprint defined in `render.yaml`.

The deployment creates:
- a Render PostgreSQL database
- a backend web service
- a frontend static site

## 1. Push the latest code

Make sure `render.yaml` and your latest backend/frontend changes are pushed to the branch Render will deploy from.

Example:

```powershell
git add .
git commit -m "Prepare Render deployment"
git push origin main
```

## 2. Create the Blueprint on Render

In Render:

1. Go to `New -> Blueprint`
2. Connect the GitHub repo
3. Let Render read `render.yaml`
4. Deploy the Blueprint

This creates:
- `foodbank-db`
- `foodbank-backend`
- `foodbank-frontend`

## 3. Fill in the Render environment variables

After the first deploy finishes, copy each service URL from Render and wire the frontend/backend together.

### Backend

In `foodbank-backend -> Environment`, set:

- `CORS_ORIGINS` = your frontend Render URL

Example:

```text
https://foodbank-frontend-xxxx.onrender.com
```

### Frontend

In `foodbank-frontend -> Environment`, set:

- `VITE_API_BASE_URL` = your backend Render URL

Example:

```text
https://foodbank-backend-xxxx.onrender.com
```

## 4. Redeploy after setting the URLs

This is important.

- Redeploy the frontend after setting `VITE_API_BASE_URL`
- Redeploy the backend after setting `CORS_ORIGINS`

The frontend must be rebuilt because Vite reads `VITE_API_BASE_URL` at build time.

## 5. Bootstrap the app

Once the backend is live, initialize the database by sending a `POST` request to:

```text
https://your-backend.onrender.com/bootstrap
```

Use Postman and send JSON.

Minimum example:

```json
{
  "food_bank_name": "My Food Bank",
  "food_bank_address": "123 Main St",
  "location_name": "Main Warehouse",
  "location_address": "123 Main St",
  "admin_email": "admin@myfoodbank.org",
  "admin_name": "Admin User"
}
```

The response returns:
- the admin email
- a temporary password

Save the temporary password immediately.

## 6. Optional bootstrap flags

The bootstrap request supports optional test-data flags.

### Seed dummy inventory

```json
"include_dummy_inventory": true
```

This adds:
- dummy users
- extra locations
- sample inventory

### Seed dummy forecast movements

```json
"include_dummy_forecast_movements": true
```

This adds synthetic movement history for forecasting tests.

Important:
- `include_dummy_forecast_movements` should only be used together with `include_dummy_inventory`

Example with both flags:

```json
{
  "food_bank_name": "My Food Bank",
  "food_bank_address": "123 Main St",
  "location_name": "Main Warehouse",
  "location_address": "123 Main St",
  "admin_email": "admin@myfoodbank.org",
  "admin_name": "Admin User",
  "include_dummy_inventory": true,
  "include_dummy_forecast_movements": true
}
```

## 7. Log in to the app

Open the frontend Render URL and log in using:
- the admin email from the bootstrap request
- the temporary password returned by the backend

On first login, the admin user will be required to change their password.

## 8. Useful checks if something goes wrong

### If frontend login fails

Check:
- `VITE_API_BASE_URL` points to the backend Render URL
- `CORS_ORIGINS` points to the frontend Render URL
- the frontend was redeployed after changing env vars

### If bootstrap fails

Check Render backend logs in:

- `foodbank-backend -> Logs`

### If you want to test the backend directly

Use Postman for:

- `POST /bootstrap`
- `POST /auth/login`
- `GET /auth/me`

## 9. Mobile App Deployment

The mobile app (`mobile-inventory/`) is built and distributed separately from the Render deployment using Expo's EAS (Expo Application Services).

### Prerequisites

- An Expo account (free at expo.dev)
- EAS CLI installed: `sudo npm install -g eas-cli`

### Set the backend URL

Create `mobile-inventory/.env` (not committed to git):

```text
EXPO_PUBLIC_API_URL=https://your-backend.onrender.com
```

Replace with your actual Render backend URL.

### Android build (no app store required)

```bash
eas login
cd mobile-inventory
eas build --platform android --profile preview
```

The build runs on Expo's servers (~10–15 minutes). When complete, EAS provides a QR code and download link. Android users can scan the QR code or open the link to install the `.apk` directly on their device (enable "Install from unknown sources" if prompted).

### iOS (demo only)

Install **Expo Go** from the App Store, then run:

```bash
cd mobile-inventory
npx expo start
```

Scan the QR code from the terminal using the iPhone camera. The app will open in Expo Go. All devices must be on the same WiFi network as the host machine to load the app bundle, but API calls go to the Render backend and work from any network.

## Summary

The deployment flow is:

1. Push code to GitHub
2. Deploy Blueprint on Render
3. Set `CORS_ORIGINS` and `VITE_API_BASE_URL`
4. Redeploy frontend and backend
5. Send `POST /bootstrap`
6. Log in with the generated admin account
7. For mobile: build Android via EAS or run iOS via Expo Go