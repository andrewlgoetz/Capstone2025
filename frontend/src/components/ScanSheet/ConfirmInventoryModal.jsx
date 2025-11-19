import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, Typography } from '@mui/material'
import { createItem, fetchInventoryByBarcode, increaseInventory } from '../../services/api'

// A small, extendable confirm modal for inventory items.
// Props: open, onClose, initial (object), imageUrl, onConfirm

const ConfirmInventoryModal = ({ open, onClose, initial = {}, imageUrl, onConfirm }) => {
  const [form, setForm] = useState({
    barcode: '',
    quantity: '',
    name: '',
    category: '',
    expiry_date: '',
  })

  useEffect(() => {
    if (initial) {
      setForm({
        barcode: initial.barcode || '',
        quantity: initial.quantity ?? '',
        name: initial.name || '',
        category: initial.category || '',
        expiry_date: initial.expiry_date || '',
      })
    }
  }, [initial])

  const handleChange = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleConfirm = () => {
    // perform create on backend, then notify parent
    setSaving(true)
    setError(null)
    const doCreate = async () => {
      try {
        const payload = {
          barcode: form.barcode,
          quantity: Number(form.quantity) || 0,
          name: form.name || '',
          category: form.category || '',
          expiration_date: form.expiry_date || null,
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
      <DialogTitle>Confirm inventory</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Box sx={{ flex: '0 0 160px', display: 'grid', placeItems: 'center' }}>
            {imageUrl ? (
              // keep image aspect and fit
              <img src={imageUrl} alt={form.name || 'item image'} style={{ width: 150, height: 150, objectFit: 'cover', borderRadius: 8 }} />
            ) : (
              <Box sx={{ width: 150, height: 150, bgcolor: '#f3f4f6', borderRadius: 1 }} />
            )}
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Barcode" value={form.barcode} InputProps={{ readOnly: true }} />

            <TextField
              label="Quantity"
              value={form.quantity}
              onChange={handleChange('quantity')}
              inputProps={{ inputMode: 'numeric' }}
              sx={{ fontSize: '1.5rem' }}
              autoFocus
            />

            <TextField label="Name" value={form.name} onChange={handleChange('name')} />
            <TextField label="Category" value={form.category} onChange={handleChange('category')} />
            <TextField label="Expiry date" value={form.expiry_date} onChange={handleChange('expiry_date')} placeholder="YYYY-MM-DD" />

            <Typography variant="caption" color="textSecondary">You can edit fields before confirming. Quantity is prominently visible above.</Typography>
            {error && <Typography variant="body2" color="error">{error}</Typography>}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={saving || !form.barcode}>
          {saving ? 'Saving…' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmInventoryModal
