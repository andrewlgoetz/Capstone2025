import { useState } from 'react';
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'
import { Snackbar, Alert } from "@mui/material";
import { useMutation, useQueryClient } from '@tanstack/react-query'
import InventoryTable from '../components/InventoryTable'
import AddItemModal from '../components/AddItemModal'
import { createItem, updateItem, deleteItem } from '../services/api'

export default function Inventory() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);

  const [categories, setCategories] = useState([]);

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

  const deleteItemMutation = useMutation({
    mutationFn: (item_id) => deleteItem(item_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e) => {
      let msg = 'Failed to delete item';
      if (e?.message) {
        msg = e.message;
      }
      console.error('Delete failed:', e);
      alert(msg);
    },
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

  const handleDeleteClick = (item) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${item.name}" (ID ${item.item_id})? This cannot be undone.`
    );
    if (!confirmed) return;

    deleteItemMutation.mutate(item.item_id);
  };

  // called by AddItemModal
  const handleSave = ({ mode, item_id, payload }) => {
    if (mode === 'edit') {
      updateItemMutation.mutate({ item_id, payload });
    } else {
      addItemMutation.mutate(payload);
    }
  };

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
      // onRowClick={(item) => navigate(`/inventory/${item.item_id}`)}
      lowStockThreshold={25}
      showFilterBar
      onEditClick={handleEditClick}
      onDeleteClick={handleDeleteClick}
      onCategoriesLoaded={(cats) => setCategories(cats)}
    />

    <AddItemModal
      open={open}
      onClose={closeModal}
      onSave={handleSave}             // gets { mode, item_id, payload }
      isSaving={isSaving}
      mode={editItem ? 'edit' : 'add'}
      defaultValues={editItem}
      categories={categories}
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