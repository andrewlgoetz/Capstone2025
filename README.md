# Inventory Tracking System (ITS) for Non-Profits
**McMaster University CS Capstone 2025**

**Members: Alyssa Wang &lt;wanga121@mcmaster.ca>; Victor Moucattash &lt;moucattv@mcmaster.ca>; Taaliah Ayub &lt;ayubt@mcmaster.ca>; Haley Johnson &lt;johnsh20@mcmaster.ca>; Nika Khajehpour &lt;khajehn@mcmaster.ca>; Insiyah Yusuf Ujjainwala &lt;ujjainwi@mcmaster.ca>**
---

## Accessing the Deployed App

The application is live at:

**Frontend:** https://foodbank-frontend-tf1f.onrender.com

**Backend API:** https://foodbank-backend-8qwm.onrender.com

**API Docs (Swagger):** https://foodbank-backend-8qwm.onrender.com/docs

### Test Account Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hamfoodbank.org | admin123 |

> **Note:** The app is hosted on Render's free tier. If the page takes 30–60 seconds to load, the server is spinning up from idle, it's normal.

---

## Mobile App

The companion mobile app is built with Expo/React Native.

### iOS (Expo Go)
1. Install **Expo Go** from the App Store
2. Clone the repo and navigate to the mobile folder:
```bash
cd mobile-inventory
npm install
npx expo start
```
3. Scan the QR code in the terminal with your phone camera — the app opens in Expo Go
4. Log in with the same credentials above

> Your phone and laptop must be on the same WiFi to load the app. API calls go to the deployed backend and work from any network.

### Android
A pre-built `.apk` is available at: https://expo.dev/accounts/alyssawang121/projects/mobile-inventory/builds/d92b82ef-cdf0-4316-9761-92336c6e232e

Scan the QR code or open the link on an Android device to install directly (no app store required).
![Android QR Code](<android-qr.png>)

---

## Running Locally

See [set_up.md](set_up.md) for full local development setup instructions covering the backend, frontend, and mobile app.

For deployment instructions see [Deployment.md](Deployment.md).
