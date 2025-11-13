import { useState } from 'react';
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'
import { Snackbar, Alert } from "@mui/material";
import { useMutation, useQueryClient } from '@tanstack/react-query'
import InventoryTable from '../components/InventoryTable'
import AddItemModal from '../components/AddItemModal'
import { createItem } from '../services/api'

export default function Inventory() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false);
  const queryClient = useQueryClient()

  const addItemMutation = useMutation({
    mutationFn: createItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setSuccessOpen(true);
      setOpen(false);
    },
    onError: (e, payload) => {
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
  })

  const handleSave = (payload) => {
      console.log(payload);
      addItemMutation.mutate(payload);
    };

  return (
    <Box sx={{ p: 5 }}>
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 16 }}
        >
        <Typography variant="h4">Inventory</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Add Item</Button>
      </header>

      <InventoryTable
        mode="full"
        onRowClick={(item) => navigate(`/inventory/${item.item_id}`)}
        lowStockThreshold={25}
        showFilterBar
      />

      <AddItemModal
        open={open}
        onClose={() => setOpen(false)}
        onSave={handleSave}
        isSaving={addItemMutation.isPending}
      />

      <Snackbar
        open={successOpen}
        autoHideDuration={3000}
        onClose={() => setSuccessOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert onClose={() => setSuccessOpen(false)} severity="success" variant="filled">
          Item added successfully!
        </Alert>
      </Snackbar>
    </Box>
  )
}