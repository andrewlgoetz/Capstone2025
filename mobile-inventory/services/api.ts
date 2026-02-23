import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const API_URL = 'http://xxx:8000';
// example: 
// export const API_URL = 'http://192.168.1.129:8000';
// and run the backend w/  uvicorn app.main:app --reload --host 0.0.0.0

const TOKEN_KEY = 'access_token';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Attach token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh: on 401, try POST /auth/refresh with current token, retry original request
let isRefreshing = false;
let refreshQueue: ((token: string) => void)[] = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401, and not on login/refresh endpoints themselves
    if (
      error.response?.status !== 401 ||
      originalRequest._retried ||
      originalRequest.url === '/auth/login' ||
      originalRequest.url === '/auth/refresh'
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Another refresh is in progress — queue this request
      return new Promise((resolve) => {
        refreshQueue.push((newToken: string) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(originalRequest));
        });
      });
    }

    originalRequest._retried = true;
    isRefreshing = true;

    try {
      const res = await api.post<TokenResponse>('/auth/refresh');
      const newToken = res.data.access_token;
      await SecureStore.setItemAsync(TOKEN_KEY, newToken);

      // Retry queued requests
      refreshQueue.forEach((cb) => cb(newToken));
      refreshQueue = [];

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch {
      // Refresh failed — token is truly expired, clear and let AuthContext handle logout
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      refreshQueue = [];
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);

// --- Token helpers ---

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function storeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// --- Auth API ---

export interface TokenResponse {
  access_token: string;
  token_type: string;
  requires_password_change: boolean;
}

export interface UserLocation {
  location_id: number;
  name: string;
}

export interface UserInfo {
  user_id: number;
  name: string;
  email: string;
  bank_id: number;
  role_id: number;
  requires_password_change: boolean;
  role_name: string;
  locations: UserLocation[];
}

export interface PermissionsResponse {
  user_id: number;
  permissions: string[];
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  // Backend expects OAuth2 form-encoded data
  // Use plain string — URLSearchParams.toString() is unreliable in React Native
  const body = `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;

  const response = await api.post<TokenResponse>('/auth/login', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data;
}

export async function getMe(): Promise<UserInfo> {
  const response = await api.get<UserInfo>('/auth/me');
  return response.data;
}

export async function getMyPermissions(): Promise<PermissionsResponse> {
  const response = await api.get<PermissionsResponse>('/auth/me/permissions');
  return response.data;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await api.post('/auth/change-password', {
    old_password: oldPassword,
    new_password: newPassword,
  });
}

export default api;
