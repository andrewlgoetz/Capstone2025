import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import InventoryTable from '../components/InventoryTable'

export default function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const dummyItems = [
  {
    item_id: 1,
    name: 'Canned Beans',
    description: 'Black beans in tomato sauce',
    category: 'Food',
    category_id: 1,
    barcode: '012345678905',
    quantity: 45,
    unit: 'cans',
    expiration_date: '2026-12-31',
    location_id: 1,
    location_name: 'Main Warehouse',
    min_quantity: 10,
    notes: 'Popular item',
    date_added: '2024-10-01T10:30:00',
    last_modified: '2024-10-15T14:22:00',
  },
  {
    item_id: 2,
    name: 'Rice (5lb bag)',
    description: 'Long grain white rice',
    category: 'Food',
    category_id: 1,
    barcode: '987654321098',
    quantity: 3,
    unit: 'bags',
    expiration_date: null,
    location_id: 1,
    location_name: 'Main Warehouse',
    min_quantity: 5,
    notes: 'Low stock - reorder needed',
    date_added: '2024-09-15T08:15:00',
    last_modified: '2024-10-20T16:45:00',
  },
  {
    item_id: 3,
    name: 'Toothpaste',
    description: 'Fluoride toothpaste, mint flavor',
    category: 'Hygiene',
    category_id: 3,
    barcode: '111222333444',
    quantity: 80,
    unit: 'tubes',
    expiration_date: '2026-06-30',
    location_id: 1,
    location_name: 'Main Warehouse',
    min_quantity: 20,
    notes: null,
    date_added: '2024-09-20T11:00:00',
    last_modified: '2024-09-20T11:00:00',
  },]

  useEffect(() => {
    let cancelled = false

    async function fetchItems() {
      setLoading(true)
      setError(null)
    //   try {
    //     const res = await api.get('/inventory')
    //     if (!cancelled) setItems(res.data || [])
    //   } catch (err) {
    //     if (!cancelled) setError(err?.message || 'Failed to load inventory')
            
    //   } finally {
    //     if (!cancelled) setLoading(false)
    //   }
    setItems(dummyItems)
    setLoading(false)
    }

    fetchItems()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = items.filter((it) => {
    if (!query) return true
    return String(it.name || it.item_id || '')
      .toLowerCase()
      .includes(query.toLowerCase())
  })

  return (
    <>
      {/* <Navbar /> */}
      <main style={{ padding: 16 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1>Inventory</h1>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="search"
              placeholder="Search inventory"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search inventory"
              style={{ padding: '6px 8px' }}
            />
            <button onClick={() => { /* TODO: open add item modal */ }}>
              Add Item
            </button>
          </div>
        </header>

        {loading && <p>Loading inventory…</p>}
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}

        {!loading && !error && (
          filtered.length > 0 ? (
            <InventoryTable
              mode="full"
              items={filtered}
              onRowClick={(item) => navigate(`/inventory/${item.item_id}`)}
            />
          ) : (
            <p>No items found.</p>
          )
        )}
      </main>
    </>
  )
}
