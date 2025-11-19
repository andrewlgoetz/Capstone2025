import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, Typography } from '@mui/material'

// Minimal modal for confirming a quantity to scan out. Props: open, onClose, initial (object with barcode, quantity), imageUrl, onConfirm
const ConfirmQuantityModal = ({ open, onClose, initial = {}, imageUrl, onConfirm }) => {
  const [quantity, setQuantity] = useState(initial.quantity ?? '')

  useEffect(() => {
    setQuantity(initial.quantity ?? '')
  }, [initial])

  const handleConfirm = () => {
    onConfirm?.({ barcode: initial.barcode, quantity: Number(quantity) })
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

          <TextField
            label="Quantity to take out"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputProps={{ inputMode: 'numeric' }}
            sx={{ mt: 1, fontSize: '1.5rem' }}
            autoFocus
            fullWidth
          />

          <Typography variant="caption" color="textSecondary">Enter number of items to remove from inventory.</Typography>
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
