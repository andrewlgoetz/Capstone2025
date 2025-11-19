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

// Dummy: return a hardcoded inventory object for a barcode (async to mimic network)
export async function fetchInventoryByBarcode(barcode) {
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
export async function scanOutInventory(barcode, qty = 1) {
  // For the dummy implementation, call fetchInventoryByBarcode and adjust quantity
  const item = await fetchInventoryByBarcode(barcode)
  // If qty >= item.quantity we'll simulate deleting the item
  const remaining = Math.max(0, (item.quantity || 0) - Number(qty))

  return new Promise((resolve) => setTimeout(() => resolve({
    barcode,
    requested: qty,
    previous_quantity: item.quantity || 0,
    remaining_quantity: remaining,
    deleted: remaining === 0,
  }), 150))
}