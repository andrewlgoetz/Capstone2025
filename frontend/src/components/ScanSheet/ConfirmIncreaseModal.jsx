import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, Typography, IconButton } from '@mui/material'
import RemoveIcon from '@mui/icons-material/Remove'
import AddIcon from '@mui/icons-material/Add'

// Modal for confirming an increase (scan-in for existing item)
const ConfirmIncreaseModal = ({ open, onClose, initial = {}, imageUrl, onConfirm }) => {
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    setQuantity(1)
  }, [initial, open])

  const handleConfirm = () => {
    onConfirm?.({ barcode: initial.barcode, item_id: initial.item_id, quantity: Number(quantity) })
    onClose?.()
  }

  return (
    <Dialog open={Boolean(open)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Scan In — Add Quantity</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Box sx={{ flex: '0 0 160px', display: 'grid', placeItems: 'center' }}>
            {imageUrl ? (
              <img src={imageUrl} alt={initial.name || 'item image'} style={{ width: 150, height: 150, objectFit: 'cover', borderRadius: 8 }} />
            ) : (
              <Box sx={{ width: 150, height: 150, bgcolor: '#f3f4f6', borderRadius: 1 }} />
            )}
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Barcode" value={initial.barcode || ''} InputProps={{ readOnly: true }} />
            <TextField label="Name" value={initial.name || ''} InputProps={{ readOnly: true }} />
            <TextField label="Category" value={initial.category || ''} InputProps={{ readOnly: true }} />

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <IconButton size="small" onClick={() => setQuantity((q) => Math.max(0, Number(q || 0) - 1))} aria-label="decrease">
                <RemoveIcon />
              </IconButton>

              <TextField
                label="Quantity to add"
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

            <Typography variant="caption" color="textSecondary">Only quantity is editable for existing items.</Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm}>Confirm</Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmIncreaseModal
