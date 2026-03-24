import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Box, Typography, IconButton, FormControlLabel, Checkbox } from '@mui/material'
import RemoveIcon from '@mui/icons-material/Remove'
import AddIcon from '@mui/icons-material/Add'

// Modal for confirming an increase (scan-in for existing item)
const ConfirmIncreaseModal = ({ open, onClose, initial = {}, imageUrl, onConfirm }) => {
  const [quantity, setQuantity] = useState(1)
  const [isAdjustment, setIsAdjustment] = useState(false)

  useEffect(() => {
    if (open) {
      setQuantity(1)
      setIsAdjustment(false)
    }
  }, [open])

  const handleConfirm = () => {
    onConfirm?.({ barcode: initial.barcode, item_id: initial.item_id, quantity: Number(quantity), isAdjustment })
    onClose?.()
  }

  return (
    <Dialog open={Boolean(open)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className="text-lg font-semibold text-slate-800 tracking-tight">Scan In — Add Quantity</DialogTitle>
      <DialogContent className="bg-white p-4 rounded-xl shadow-lg border border-gray-200">
        <Box className="flex gap-2 flex-col sm:flex-row">
          <Box sx={{ flex: '0 0 160px', display: 'grid', placeItems: 'center' }}>
            {imageUrl ? (
              <img src={imageUrl} alt={initial.name || 'item image'} style={{ width: 150, height: 150, objectFit: 'cover', borderRadius: 8 }} />
            ) : (
              <Box sx={{ width: 150, height: 150, bgcolor: '#f3f4f6', borderRadius: 1 }} />
            )}
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Barcode" value={initial.barcode || ''} InputProps={{ readOnly: true }} size="small" />
            <TextField label="Name" value={initial.name || ''} InputProps={{ readOnly: true }} size="small" />
            <TextField label="Category" value={initial.category || ''} InputProps={{ readOnly: true }} size="small" />

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

            <FormControlLabel
              control={<Checkbox checked={isAdjustment} onChange={(e) => setIsAdjustment(e.target.checked)} color="primary" size="small" />}
              label={<Typography variant="body2" color="textSecondary">This is a manual adjustment/correction</Typography>}
              sx={{ mt: -1 }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <div className="w-full flex justify-end gap-2 px-4 pb-4">
          <button type="button" className="px-4 py-2 rounded hover:bg-gray-100 text-slate-700 font-medium" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-white" onClick={handleConfirm}>
            Confirm
          </button>
        </div>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmIncreaseModal