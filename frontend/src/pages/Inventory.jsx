import { useState } from 'react';
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'
import InventoryTable from '../components/InventoryTable'
import AddItemModal from '../components/AddItemModal'
import { createItem } from '../services/api'

export default function Inventory() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const handleSave = async (payload) => {
    try {
      console.log(payload);
      await createItem(payload)
      setOpen(false)
      setRefreshToken(x => x + 1)
    } catch (e) {
      let msg = "Failed to save item";
      const data = e?.response?.data;
  
      if (data?.detail) {
        if (Array.isArray(data.detail)) {
          // FastAPI 422 validation errors
          msg = data.detail
            .map(d => `${(d.loc || []).join('.')}: ${d.msg}`)
            .join('\n');
        } else {
          msg = String(data.detail);
        }
      } else if (e?.message) {
        msg = e.message;
      }
  
      console.error("Save failed:", { payload, server: data, error: e });
      alert(msg);
    }
  };

  return (
    <Box sx={{ p: 5 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography variant="h4">Inventory</Typography>
        <Button variant="contained" onClick={() => { setOpen(true)/* TODO: open add item modal */ }}>Add Item</Button>
      </header>

      <InventoryTable
        mode="full"
        onRowClick={(item) => navigate(`/inventory/${item.item_id}`)}
        lowStockThreshold={5}
        showFilterBar
        refreshToken={refreshToken}
      />

      <AddItemModal
        open={open}
        onClose={() => setOpen(false)}
        onSave={handleSave}
      />
    </Box>
  )
}