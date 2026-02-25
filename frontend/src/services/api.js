import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",  // backend address
});

// Create a new item
export async function createItem(item) {
  const res = await api.post("/inventory/add", item);
  return res.data;
}

// Get all items
export async function getItems() {
  const res = await api.get("/inventory/all");
  return res.data;
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
// 2) if FOUND, call POST /barcode/scan-out/{item_id}/confirm with { quantity }
export async function scanOutInventory(barcode, qty = 1) {
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
  const confirmRes = await api.post(`/barcode/scan-out/${item_id}/confirm`, { quantity: qty })
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
export async function increaseInventory(item_id, amount = 1) {
  if (!item_id) throw new Error('item_id required')
  const res = await api.post(`/barcode/${item_id}/increase`, { amount })
  return res.data
}

// Get all categories
export async function getCategories() {
  const res = await api.get("/categories/");
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