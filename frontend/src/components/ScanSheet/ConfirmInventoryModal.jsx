import React, { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Box, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { createItem, fetchInventoryByBarcode, increaseInventory, getCategories } from '../../services/api'
import CategorySearch from '../inventory/CategorySearch'


const ConfirmInventoryModal = ({ open, onClose, initial = {}, imageUrl, onConfirm, product = null, locations = [] }) => {
  // Fetch categories from API
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const categories = useMemo(() => {
    return (categoriesQuery.data || [])
      .filter(cat => cat.is_active)
      .map(cat => cat.name);
  }, [categoriesQuery.data]);


  const [form, setForm] = useState({
    barcode: '',
    quantity: '',
    name: '',
    category: '',
    category_notes: '',
    expiry_date: '',
    unit: 'units',
    custom_unit: '',
    location_id: '',
  })


  useEffect(() => {
    if (initial) {
      // build initial form values, preferring provided initial values but falling back to product info
      const initialName = initial.name || (product?.name) || ''
      const initialQuantity = initial.quantity ?? 1
      // Use the mapped category from product (backend already mapped it) or from initial
      const initialCategory = initial.category || product?.category || ''
      // Use initial location_id if provided, otherwise auto-select if only one location available
      const autoLocation = locations.length === 1 ? String(locations[0].location_id) : ''
      const selectedLocation = initial.location_id ? String(initial.location_id) : autoLocation
      setForm({
        barcode: initial.barcode || '',
        quantity: initialQuantity,
        name: initialName,
        category: initialCategory,
        category_notes: initial.category_notes || '',
        expiry_date: initial.expiry_date || '',
        unit: initial.unit || 'units',
        custom_unit: initial.unit && !['units','kg','g','lbs','oz','cups','ml','L','packs','boxes','bags','bottles','cans','cartons','blocks','pieces','dozen','trays','rolls','sachets'].includes(initial.unit) ? initial.unit : '',
        location_id: selectedLocation,
      })
    }
  }, [initial, product, locations])


  const handleChange = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const UNIT_OPTIONS = ['units','kg','g','lbs','oz','cups','ml','L','packs','boxes','bags','bottles','cans','cartons','blocks','pieces','dozen','trays','rolls','sachets','CUSTOM']

  const handleConfirm = () => {
    // perform create on backend, then notify parent
    setSaving(true)
    setError(null)
    const doCreate = async () => {
      try {
        const unitToSend = form.unit === 'CUSTOM' ? (form.custom_unit || null) : form.unit
        const payload = {
          barcode: form.barcode,
          quantity: Number(form.quantity) || 0,
          name: form.name || '',
          category: form.category || null,
          unit: unitToSend,
          expiration_date: form.expiry_date || null,
          location_id: form.location_id ? Number(form.location_id) : null,
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

            <div>
              <Typography variant="caption" color="textSecondary" sx={{ mb: 0.5, display: 'block' }}>
                Category
              </Typography>
              <CategorySearch
                categories={categories}
                value={form.category || ''}
                onChange={(cat) => setForm(f => ({ ...f, category: cat }))}
                placeholder="Search categories…"
                inputClassName="border border-gray-300"
              />
            </div>

            <TextField label="Expiry date" value={form.expiry_date} onChange={handleChange('expiry_date')} placeholder="YYYY-MM-DD" />

            {locations.length > 1 && (
              <FormControl fullWidth>
                <InputLabel id="location-select-label">Location</InputLabel>
                <Select
                  labelId="location-select-label"
                  value={form.location_id}
                  label="Location"
                  onChange={(e) => setForm(f => ({ ...f, location_id: e.target.value }))}
                >
                  {locations.map((loc) => (
                    <MenuItem key={loc.location_id} value={String(loc.location_id)}>{loc.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

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
