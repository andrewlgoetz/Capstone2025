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

export default api;