import { useState } from 'react';
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'
import { Snackbar, Alert } from "@mui/material";
import { useMutation, useQueryClient } from '@tanstack/react-query'
import InventoryTable from '../components/InventoryTable'
import AddItemModal from '../components/AddItemModal'
import { createItem, updateItem } from '../services/api'

export default function Inventory() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);

  const closeModal = () => {
    setOpen(false);
    setEditItem(null);
  };

  // ------ shared success + error handlers ------
  const handleMutationSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    setSuccessOpen(true);
    closeModal();
  };

  const handleMutationError = (e, payload) => {
    let msg = 'Failed to save item';
    const data = e?.response?.data;

    if (data?.detail) {
      if (Array.isArray(data.detail)) {
        msg = data.detail
          .map((d) => `${(d.loc || []).join('.')}: ${d.msg}`)
          .join('\n');
      } else {
        msg = String(data.detail);
      }
    } else if (e?.message) {
      msg = e.message;
    }

    console.error('Save failed:', { payload, server: data, error: e });
    alert(msg);
  };

   // ------ mutations ------
   const addItemMutation = useMutation({
    mutationFn: createItem,
    onSuccess: handleMutationSuccess,
    onError: handleMutationError,
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ item_id, payload }) => updateItem(item_id, payload),
    onSuccess: handleMutationSuccess,
    onError: handleMutationError,
  });

  const isSaving = addItemMutation.isPending || updateItemMutation.isPending;

  // ------ handlers called by UI ------
  const handleAddClick = () => {
    setEditItem(null);      // add mode
    setOpen(true);
  };

  const handleEditClick = (item) => {
    setEditItem(item);      // edit mode, preload this row
    setOpen(true);
  };

  // called by AddItemModal
  const handleSave = ({ mode, item_id, payload }) => {
    if (mode === 'edit') {
      updateItemMutation.mutate({ item_id, payload });
    } else {
      addItemMutation.mutate(payload);
    }
  };

//   return (
//     <Box sx={{ p: 5 }}>
//       <header style={{ 
//         display: 'flex', 
//         justifyContent: 'space-between', 
//         alignItems: 'center', 
//         marginBottom: 16 }}
//         >
//         <Typography variant="h4">Inventory</Typography>
//         <Button variant="contained" onClick={() => setOpen(true)}>
//           Add Item</Button>
//       </header>

//       <InventoryTable
//         mode="full"
//         onRowClick={(item) => navigate(`/inventory/${item.item_id}`)}
//         lowStockThreshold={25}
//         showFilterBar
//       />

//       <AddItemModal
//         open={open}
//         onClose={() => setOpen(false)}
//         onSave={handleSave}
//         isSaving={addItemMutation.isPending}
//       />

//       <Snackbar
//         open={successOpen}
//         autoHideDuration={3000}
//         onClose={() => setSuccessOpen(false)}
//         anchorOrigin={{ vertical: "top", horizontal: "center" }}
//       >
//         <Alert onClose={() => setSuccessOpen(false)} severity="success" variant="filled">
//           Item added successfully!
//         </Alert>
//       </Snackbar>
//     </Box>
//   )
// }
return (
  <Box sx={{ p: 5 }}>
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}
    >
      <Typography variant="h4">Inventory</Typography>
      <Button variant="contained" onClick={handleAddClick}>
        Add Item
      </Button>
    </header>

    <InventoryTable
      mode="full"
      onRowClick={(item) => navigate(`/inventory/${item.item_id}`)}
      lowStockThreshold={25}
      showFilterBar
      onEditClick={handleEditClick}   // 🔗 wire table edit → modal
    />

    <AddItemModal
      open={open}
      onClose={closeModal}
      onSave={handleSave}             // gets { mode, item_id, payload }
      isSaving={isSaving}
      mode={editItem ? 'edit' : 'add'}
      initialValues={editItem}
    />

    <Snackbar
      open={successOpen}
      autoHideDuration={3000}
      onClose={() => setSuccessOpen(false)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        onClose={() => setSuccessOpen(false)}
        severity="success"
        variant="filled"
      >
        Item {editItem ? 'updated' : 'added'} successfully!
      </Alert>
    </Snackbar>
  </Box>
);
}