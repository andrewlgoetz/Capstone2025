import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import { createItem, fetchInventoryByBarcode, increaseInventory } from '../../services/api'

// A small, extendable confirm modal for inventory items.
// Props: open, onClose, initial (object), imageUrl, onConfirm

const ConfirmInventoryModal = ({ open, onClose, initial = {}, imageUrl, onConfirm, product = null }) => {
  const [form, setForm] = useState({
    barcode: '',
    quantity: '',
    name: '',
  category: '',
  expiry_date: '',
  unit: 'units',
  custom_unit: '',
  })

  const CATEGORY_OPTIONS = React.useMemo(() => ['Produce','Meat','Dairy','Eggs','Bakery','Frozen','Drinks','Pantry','Canned Goods','Household','Personal Care','Other','CUSTOM'], [])
  const [categoryOptions, setCategoryOptions] = useState(CATEGORY_OPTIONS)

  useEffect(() => {
    if (initial) {
      // build initial form values, preferring provided initial values but falling back to product info
      const initialName = initial.name || (product?.product_name) || ''
      const initialQuantity = initial.quantity ?? 1
      const initialCategory = initial.category || null
      const initialCustomCategory = initialCategory && !CATEGORY_OPTIONS.includes(initialCategory) ? initialCategory : ''
      setForm({
        barcode: initial.barcode || '',
        quantity: initialQuantity,
        name: initialName,
  category: initialCategory || '',
  expiry_date: initial.expiry_date || '',
  unit: initial.unit || 'units',
  custom_unit: initial.unit && !['units','kgs','g','lbs','cups','oz','packs','blocks','cartons','bottles','cans'].includes(initial.unit) ? initial.unit : '',
  custom_category: initialCustomCategory,
      })
    }
  }, [initial, product, CATEGORY_OPTIONS])

  // when product changes, compute category options so product categories appear at top
  useEffect(() => {
    if (!product) return
    // prefer categories string, fallback to categories_tags
    let prodCats = []
    if (product.categories) {
      prodCats = product.categories.split(',').map(s => s.trim()).filter(Boolean)
    } else if (product.categories_tags) {
      prodCats = product.categories_tags.map(t => t.split(':').pop().replace(/-/g, ' '))
    }

    if (prodCats.length) {
      // merge with existing options, keeping order and uniqueness
      const merged = [...prodCats, ...CATEGORY_OPTIONS.filter(c => !prodCats.includes(c))]
      setCategoryOptions(merged)
      // if form has no category, prefill with top product category
      setForm(f => ({ ...f, category: f.category || prodCats[0] || '' }))
    }
  }, [product, CATEGORY_OPTIONS])

  const handleChange = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const UNIT_OPTIONS = ['units','kgs','g','lbs','cups','oz','packs','blocks','cartons','bottles','cans','CUSTOM']

  const handleConfirm = () => {
    // perform create on backend, then notify parent
    setSaving(true)
    setError(null)
    const doCreate = async () => {
      try {
        const unitToSend = form.unit === 'CUSTOM' ? (form.custom_unit || null) : form.unit
        const categoryToSend = form.category === 'CUSTOM' ? (form.custom_category || null) : (form.category || null)
        const payload = {
          barcode: form.barcode,
          quantity: Number(form.quantity) || 0,
          name: form.name || '',
          category: categoryToSend,
          unit: unitToSend,
          expiration_date: form.expiry_date || null,
          location_id: 1,
        }
        const created = await createItem(payload)
        onConfirm?.(created)
        onClose?.()
      } catch (err) {
        console.error('Create item failed', err)
        const status = err?.response?.status
        const detail = err?.response?.data?.detail || err.message || 'Create failed'
        // If barcode already exists, try to increase quantity on existing item instead
        if (status === 409) {
          try {
            const existing = await fetchInventoryByBarcode(form.barcode)
            if (existing && existing.item_id) {
              const added = await increaseInventory(existing.item_id, Number(form.quantity) || 0)
              onConfirm?.(added)
              onClose?.()
              return
            }
          } catch (innerErr) {
            console.error('Failed to resolve duplicate barcode by increasing', innerErr)
            setError(detail)
            return
          }
        }
        setError(detail)
      } finally {
        setSaving(false)
      }
    }
    doCreate()
  }

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  return (
    <Dialog open={Boolean(open)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className="text-xl font-semibold text-slate-800 tracking-tight">Confirm inventory</DialogTitle>
      <DialogContent className="bg-white p-4 rounded-xl shadow-lg border border-gray-200">
        <Box className="flex gap-2 flex-col sm:flex-row">
          <Box sx={{ flex: '0 0 160px', display: 'grid', placeItems: 'center' }}>
            {imageUrl ? (
              // taller vertical image (approx 2:3) to match OFF product photos
              <img src={imageUrl} alt={form.name || 'item image'} style={{ width: 150, height: 220, objectFit: 'cover', borderRadius: 8 }} />
            ) : (
              <Box sx={{ width: 150, height: 220, bgcolor: '#f3f4f6', borderRadius: 1 }} />
            )}
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Barcode" value={form.barcode} InputProps={{ readOnly: true }} />

            <TextField
              label="Quantity"
              value={form.quantity}
              onChange={handleChange('quantity')}
              inputProps={{ inputMode: 'numeric' }}
              sx={{ fontSize: '1.5rem' }}
              autoFocus
            />

            <FormControl fullWidth>
              <InputLabel id="unit-select-label">Unit</InputLabel>
              <Select
                labelId="unit-select-label"
                value={form.unit}
                label="Unit"
                onChange={(e) => setForm(f => ({ ...f, unit: e.target.value }))}
              >
                {UNIT_OPTIONS.map((u) => (
                  <MenuItem key={u} value={u}>{u}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {form.unit === 'CUSTOM' && (
              <TextField label="Custom unit" value={form.custom_unit} onChange={handleChange('custom_unit')} fullWidth />
            )}

            <TextField label="Name" value={form.name} onChange={handleChange('name')} />

            <FormControl fullWidth>
              <InputLabel id="category-select-label">Category</InputLabel>
              <Select
                labelId="category-select-label"
                value={form.category || ''}
                label="Category"
                onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
              >
                {categoryOptions.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {form.category === 'CUSTOM' && (
              <TextField label="Custom category" value={form.custom_category || ''} onChange={(e) => setForm(f => ({ ...f, custom_category: e.target.value }))} fullWidth />
            )}
            <TextField label="Expiry date" value={form.expiry_date} onChange={handleChange('expiry_date')} placeholder="YYYY-MM-DD" />

            <Typography variant="caption" color="textSecondary">You can edit fields before confirming.</Typography>
            {error && <Typography variant="body2" color="error">{error}</Typography>}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <div className="w-full flex justify-end gap-2 px-4 pb-4">
          <button
            type="button"
            className="px-4 py-2 rounded hover:bg-gray-100 text-slate-700 font-medium"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className={`px-4 py-2 rounded ${saving || !form.barcode ? 'opacity-50 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
            onClick={handleConfirm}
            disabled={saving || !form.barcode}
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmInventoryModal
