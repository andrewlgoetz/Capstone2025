import axios from "axios";
import { jwtDecode } from 'jwt-decode';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
});

// Request interceptor - add JWT token and auto-refresh if needed
api.interceptors.request.use(
  async (config) => {
    let token = localStorage.getItem('access_token');

    if (token) {
      try {
        // Check if token is close to expiration (within 5 minutes)
        const decoded = jwtDecode(token);
        const expiresIn = decoded.exp * 1000 - Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        if (expiresIn < fiveMinutes && expiresIn > 0) {
          // Token expiring soon, refresh it
          try {
            const response = await axios.post('http://127.0.0.1:8000/auth/refresh', {}, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            token = response.data.access_token;
            localStorage.setItem('access_token', token);
          } catch (error) {
            // Refresh failed, will use old token (might get 401)
            console.error('Token refresh failed:', error);
          }
        }
      } catch (error) {
        // Token decode failed, continue with existing token
        console.error('Token decode error:', error);
      }

      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401 (unauthorized) globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid - redirect to login
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// --------------- Auth API Functions ---------------

// Login - uses axios directly (not api instance) to avoid interceptor on login
export async function loginUser(email, password) {
  // OAuth2 form data format
  const formData = new URLSearchParams();
  formData.append('username', email);  // OAuth2 uses 'username' field
  formData.append('password', password);

  const res = await axios.post('http://127.0.0.1:8000/auth/login', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  return res.data;
}

export async function getCurrentUser() {
  const res = await api.get('/auth/me');
  return res.data;
}

export async function changePassword(oldPassword, newPassword) {
  const res = await api.post('/auth/change-password', {
    old_password: oldPassword,
    new_password: newPassword
  });
  return res.data;
}

export async function getAllUsers() {
  const res = await api.get('/auth/users');
  return res.data;
}

export async function createUser(userData) {
  const res = await api.post('/auth/users', userData);
  return res.data;
}

export async function updateUser(userId, userData) {
  const res = await api.put(`/auth/users/${userId}`, userData);
  return res.data;
}

export async function resetUserPassword(userId) {
  const res = await api.post(`/auth/users/${userId}/reset-password`);
  return res.data;
}

export async function getUserActivityLog(userId) {
  const res = await api.get(`/auth/users/${userId}/activity`);
  return res.data;
}

// --------------- Permission API Functions ---------------

export async function getAllPermissions() {
  const res = await api.get('/auth/permissions');
  return res.data;
}

export async function getMyPermissions() {
  const res = await api.get('/auth/me/permissions');
  return res.data;
}

export async function getUserPermissions(userId) {
  const res = await api.get(`/auth/users/${userId}/permissions`);
  return res.data;
}

export async function updateUserPermissions(userId, permissions) {
  const res = await api.put(`/auth/users/${userId}/permissions`, { permissions });
  return res.data;
}

// --------------- Location API Functions ---------------

export async function getMyLocations() {
  const res = await api.get('/locations');
  return res.data;
}

export async function getAllBankLocations() {
  const res = await api.get('/locations/all');
  return res.data;
}

export async function createLocation(data) {
  const res = await api.post('/locations', data);
  return res.data;
}

export async function updateLocation(locationId, data) {
  const res = await api.put(`/locations/${locationId}`, data);
  return res.data;
}

export async function deleteLocation(locationId) {
  const res = await api.delete(`/locations/${locationId}`);
  return res.data;
}

export async function getUserLocations(userId) {
  const res = await api.get(`/auth/users/${userId}/locations`);
  return res.data;
}

export async function updateUserLocations(userId, locationIds) {
  const res = await api.put(`/auth/users/${userId}/locations`, { location_ids: locationIds });
  return res.data;
}

// --------------- Inventory API Functions ---------------

// Create a new item
export async function createItem(item) {
  const res = await api.post("/inventory/add", item);
  return res.data;
}

// Get all items (optionally filtered by location IDs)
export async function getItems(locationIds) {
  const params = locationIds?.length ? { location_ids: locationIds.join(',') } : {};
  const res = await api.get("/inventory/all", { params });
  return res.data;
}

export async function getMonthlyDistributed(locationIds) {
  const params = locationIds?.length ? { location_ids: locationIds.join(',') } : {};
  const res = await api.get('/inventory/dashboard/monthly-distributed', { params });
  return res.data;
}

export async function getInventoryMovements(locationIds, limit = 500) {
  const params = {
    limit,
    ...(locationIds?.length ? { location_ids: locationIds.join(',') } : {}),
  };
  const res = await api.get('/inventory/movements', { params });
  return res.data;
}

export async function exportInventoryCSV(locationIds) {
  const params = locationIds?.length
    ? { location_ids: locationIds.join(',') }
    : {};

  const res = await api.get('/inventory/export', {
    params,
    responseType: 'blob',
  });

  return res.data;
}

export async function searchInventoryItems(query, locationIds) {
  const params = {
    query,
    ...(locationIds?.length && { location_ids: locationIds.join(',') })
  };

  const res = await api.get('/inventory/search', { params });
  return res.data;
}

export async function scanOutInventoryByItemId(item_id, qty = 1, location_id = null) {
  if (!item_id) throw new Error('item_id required');

  const confirmBody = { quantity: qty };
  if (location_id != null) confirmBody.location_id = location_id;

  const confirmRes = await api.post(`/barcode/scan-out/${item_id}/confirm`, confirmBody);
  const updated = confirmRes.data;

  return {
    status: 'OK',
    requested: qty,
    remaining_quantity: updated.quantity ?? null,
    deleted: updated.quantity === 0,
    item: updated,
  };
}

// Delete item
export async function deleteItem(itemId) {
  const res = await api.delete(`/inventory/${itemId}`);
  return res.data;
}

// Update item
export const updateItem = (item_id, item) =>
  api.put(`/inventory/${item_id}`, item);

export default api;
// REAL: call backend barcode routes
// fetchInventoryByBarcode now calls POST /barcode/scan-in which returns a ScanResponse
export async function fetchInventoryByBarcode(barcode) {
  if (!barcode) throw new Error('No barcode provided')

  const res = await api.post('/barcode/scan-in', { barcode })
  // res.data should match ScanResponse: { status: 'KNOWN'|'NEW', item?, candidate_info? }
  const data = res.data

  if (data.status === 'KNOWN' && data.item) {
    // normalize to the shape the frontend expects: { barcode, quantity, name, category, expiry_date }
    const it = data.item
    return {
      barcode: it.barcode,
      quantity: it.quantity,
      name: it.name,
      category: it.category,
      expiry_date: it.expiration_date || it.expiry_date || null,
      item_id: it.item_id,
      raw: it,
    }
  }

  if (data.status === 'NEW' && data.candidate_info) {
    const c = data.candidate_info
    return {
      barcode: c.barcode || barcode,
      quantity: 1,
      name: c.name || '',
      category: c.category || '',
      expiry_date: null,
      raw: data,
    }
  }

  // Fallback: return minimal object
  return { barcode, quantity: 1, name: '', category: '', expiry_date: null, raw: data }
}

// scanOutInventory: 1) call POST /barcode/scan-out with barcode to find existing item
// 2) if FOUND, call POST /barcode/scan-out/{item_id}/confirm with { quantity, location_id? }
export async function scanOutInventory(barcode, qty = 1, location_id = null) {
  if (!barcode) throw new Error('No barcode provided')

  // 1) lookup
  const lookup = await api.post('/barcode/scan-out', { barcode })
  const lookupData = lookup.data

  if (lookupData.status === 'NOT_FOUND') {
    return { status: 'NOT_FOUND', barcode }
  }

  const item = lookupData.item
  const previous_quantity = item?.quantity ?? 0
  const item_id = item?.item_id

  // 2) confirm scan out
  const confirmBody = { quantity: qty }
  if (location_id != null) confirmBody.location_id = location_id
  const confirmRes = await api.post(`/barcode/scan-out/${item_id}/confirm`, confirmBody)
  const updated = confirmRes.data

  return {
    status: 'OK',
    barcode,
    requested: qty,
    previous_quantity,
    remaining_quantity: updated.quantity ?? null,
    deleted: (updated.quantity === 0),
    item: updated,
  }
}

// Increase inventory quantity for an existing item (scan-in known item)
export async function increaseInventory(item_id, amount = 1, location_id = null) {
  if (!item_id) throw new Error('item_id required')
  const body = { amount }
  if (location_id != null) body.location_id = location_id
  const res = await api.post(`/barcode/${item_id}/increase`, body)
  return res.data
}

// Bulk import from CSV file
export async function bulkImportCSV(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post('/inventory/bulk-import/csv', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return res.data
}

// Bulk import from JSON file
export async function bulkImportJSON(jsonData) {
  const res = await api.post('/inventory/bulk-import/json', jsonData)
  return res.data
}

// Get all categories
export async function getCategories(includeInactive = false) {
  const res = await api.get("/categories/", { params: includeInactive ? { include_inactive: true } : {} });
  return res.data;
}

export async function createCategory(data) {
  const res = await api.post("/categories/", data);
  return res.data;
}

export async function updateCategory(categoryId, data) {
  const res = await api.put(`/categories/${categoryId}`, data);
  return res.data;
}

export async function deactivateCategory(categoryId) {
  const res = await api.delete(`/categories/${categoryId}`);
  return res.data;
}

export async function reactivateCategory(categoryId) {
  const res = await api.post(`/categories/${categoryId}/reactivate`);
  return res.data;
}

// --------------- Dietary Restrictions API Functions ---------------

export async function getDietaryRestrictions(includeInactive = false) {
  const res = await api.get("/dietary-restrictions/", { params: includeInactive ? { include_inactive: true } : {} });
  return res.data;
}

export async function createDietaryRestriction(data) {
  const res = await api.post("/dietary-restrictions/", data);
  return res.data;
}

export async function updateDietaryRestriction(restrictionId, data) {
  const res = await api.put(`/dietary-restrictions/${restrictionId}`, data);
  return res.data;
}

export async function deactivateDietaryRestriction(restrictionId) {
  const res = await api.delete(`/dietary-restrictions/${restrictionId}`);
  return res.data;
}

export async function reactivateDietaryRestriction(restrictionId) {
  const res = await api.post(`/dietary-restrictions/${restrictionId}/reactivate`);
  return res.data;
}

export async function getCategoryRequests() {
  const res = await api.get("/inventory/category-requests");
  return res.data;
}

export async function dismissCategoryRequest(itemId) {
  const res = await api.put(`/inventory/${itemId}`, { category_notes: null });
  return res.data;
}

export async function downloadInventoryReport(locationIds, startDate, endDate) {
  const params = { start_date: startDate, end_date: endDate };
  if (locationIds?.length) params.location_ids = locationIds.join(',');

  const res = await api.get('/inventory/reports/download', {
    params,
    responseType: 'blob',
  });

  return res.data;
}

export async function completeCheckout(payload) {
  const res = await api.post('/checkout/complete', payload);
  return res.data;
}

export async function completeCheckin(payload) {
  const res = await api.post('/checkin/complete', payload);
  return res.data;
}

// --------------- Activity Log API Functions ---------------

export async function getItemChangesLog(limit = 100, entityType = null) {
  const params = { limit };
  if (entityType) params.entity_type = entityType;
  const res = await api.get("/activity-log/item-changes", { params });
  return res.data;
}

// --------------- Forecasting API Functions ---------------

// Fetch the latest pre-computed forecasts for all categories.
// Returns a ForecastResponse: { run_id, run_timestamp, bank_id, model_health,
//   weeks_ahead, is_stale, categories: [{ category, data_status, model_type,
//   weeks_of_history, historical, forecast, ci_80, ci_95 }] }
export async function getForecastCategory(weeksAhead = 8) {
  const res = await api.get("/forecasts/category", {
    params: { weeks_ahead: weeksAhead },
  });
  return res.data;
}

// Manually trigger a new forecast run.
// Returns { run_id, status, message } or throws on 409 (already running) / 429 (rate limited).
export async function triggerForecastRun(weeksAhead = 8) {
  const res = await api.post("/forecasts/run", null, {
    params: { weeks_ahead: weeksAhead },
  });
  return res.data;
}

// Fetch the bank-level aggregate forecast (total items/week across all categories).
// Returns an AggregateForecastResponse: { run_id, run_timestamp, bank_id, data_status,
//   model_health, is_stale, points: [{ week_start, value, is_historical, ci_lower_80, ci_upper_80 }] }
export async function getForecastAggregate() {
  const res = await api.get("/forecasts/aggregate");
  return res.data;
}

/*
  Dummy helpers (kept for local testing). Uncomment if you need the old behavior.

// Dummy: return a hardcoded inventory object for a barcode (async to mimic network)
export async function _dummy_fetchInventoryByBarcode(barcode) {
  // Example hardcoded responses for a couple of barcodes
  const map = {
    '036000291452': {
      barcode: '036000291452',
      quantity: 18,
      name: 'Milk (2%)',
      category: 'Perishables',
      expiry_date: '2025-11-20',
    },
    '076783001234': {
      barcode: '076783001234',
      quantity: 46,
      name: 'Pasta (1 lb)',
      category: 'Dry Goods',
      expiry_date: '2026-02-01',
    },
  }

  const result = map[barcode] || {
    barcode,
    quantity: 1,
    name: 'Unknown item',
    category: 'Other',
    expiry_date: '',
  }

  // simulate async latency
  return new Promise((resolve) => setTimeout(() => resolve(result), 150))
}

// Dummy scan-out: decrement quantity or simulate deletion for a barcode
export async function _dummy_scanOutInventory(barcode, qty = 1) {
  const item = await _dummy_fetchInventoryByBarcode(barcode)
  const remaining = Math.max(0, (item.quantity || 0) - Number(qty))
  return new Promise((resolve) => setTimeout(() => resolve({
    barcode,
    requested: qty,
    previous_quantity: item.quantity || 0,
    remaining_quantity: remaining,
    deleted: remaining === 0,
  }), 150))
}
*/
