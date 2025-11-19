import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, Typography, IconButton } from '@mui/material'
import RemoveIcon from '@mui/icons-material/Remove'
import AddIcon from '@mui/icons-material/Add'

// Minimal modal for confirming a quantity to scan out. Props: open, onClose, initial (object with barcode, quantity), imageUrl, onConfirm
const ConfirmQuantityModal = ({ open, onClose, initial = {}, imageUrl, onConfirm, maxQuantity = null }) => {
  const [quantity, setQuantity] = useState(initial.quantity ?? '')
  const [error, setError] = useState(null)

  useEffect(() => {
    setQuantity(initial.quantity ?? '')
  }, [initial])

  const handleConfirm = () => {
    const q = Number(quantity) || 0
    if (q <= 0) {
      setError('Quantity must be greater than 0')
      return
    }
    if (maxQuantity != null && q > Number(maxQuantity)) {
      setError(`Quantity cannot exceed available (${maxQuantity})`)
      return
    }
    setError(null)
    onConfirm?.({ barcode: initial.barcode, quantity: q })
    onClose?.()
  }

  return (
    <Dialog open={Boolean(open)} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Confirm Scan Out</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column', alignItems: 'center' }}>
          {imageUrl ? (
            <img src={imageUrl} alt={initial.name || 'item image'} style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 8 }} />
          ) : (
            <Box sx={{ width: 180, height: 180, bgcolor: '#f3f4f6', borderRadius: 1 }} />
          )}

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%', mt: 1 }}>
            <IconButton size="small" onClick={() => setQuantity((q) => Math.max(0, Number(q || 0) - 1))} aria-label="decrease">
              <RemoveIcon />
            </IconButton>

            <TextField
              label="Quantity to take out"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputProps={{ inputMode: 'numeric' }}
              sx={{ fontSize: '1.5rem', flex: 1 }}
              autoFocus
            />

            <IconButton size="small" onClick={() => setQuantity((q) => Number(q || 0) + 1)} aria-label="increase">
              <AddIcon />
            </IconButton>
          </Box>

          <Typography variant="caption" color="textSecondary">Enter number of items to remove from inventory.</Typography>
          {error && <Typography variant="body2" color="error">{error}</Typography>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm}>Confirm</Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmQuantityModal
