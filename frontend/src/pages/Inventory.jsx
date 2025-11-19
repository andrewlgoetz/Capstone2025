import { useState } from 'react';
import { useNavigate } from 'react-router-dom'
// Import icons for use in buttons
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

// Import components and utilities
import { useMutation, useQueryClient } from '@tanstack/react-query'
import InventoryTable from '../components/InventoryTable'
import AddItemModal from '../components/AddItemModal' // Assuming AddItemModal uses its own styles
import { createItem, updateItem, deleteItem } from '../services/api'

export default function Inventory() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Use state to track categories loaded by InventoryTable for AddItemModal
  const [categories, setCategories] = useState([]);

  const closeModal = () => {
    setOpen(false);
    setEditItem(null);
  };

  // ------ shared success + error handlers ------
  const handleMutationSuccess = (message) => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    setSuccessMessage(message);
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
    // Use alert for synchronous error feedback
    alert(msg);
  };

  const handleCloseSnackbar = () => {
    setSuccessOpen(false);
    setSuccessMessage("");
  };

   // ------ mutations ------
   const addItemMutation = useMutation({
    mutationFn: createItem,
    onSuccess: () => handleMutationSuccess("Item added successfully!"),
    onError: (error, variables) => handleMutationError(error, variables),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ item_id, payload }) => updateItem(item_id, payload),
    onSuccess: () => handleMutationSuccess("Item updated successfully!"),
    onError: (error, variables) => handleMutationError(error, variables),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (item_id) => deleteItem(item_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setSnack({ open: true, message: 'Item deleted successfully!', severity: 'warning' });
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
    setEditItem(null);
    setOpen(true);
  };

  const handleEditClick = (item) => {
    setEditItem(item);
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
  <div className="min-h-screen bg-gray-50 pb-16">
    <div className="max-w-7xl mx-auto p-4 md:p-6">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Inventory Management
          </h1>
          <button 
            className="flex items-center gap-1 px-4 py-2 bg-slate-800 text-white rounded-lg font-medium shadow-md hover:bg-slate-700 transition"
            onClick={handleAddClick}
          >
            <AddIcon fontSize="small" />
            Add Item
          </button>
        </header>

        {/* Inventory Table */}
        <InventoryTable
          mode="full"
          lowStockThreshold={25}
          showFilterBar
          onEditClick={handleEditClick}
          onDeleteClick={handleDeleteClick}
          onCategoriesLoaded={(cats) => setCategories(cats)}
        />

        {/* Add/Edit Modal (Assumes AddItemModal will also use Tailwind or its own styling) */}
        <AddItemModal
          open={open}
          onClose={closeModal}
          onSave={handleSave}
          isSaving={isSaving}
          mode={editItem ? 'edit' : 'add'}
          defaultValues={editItem}
          categories={categories}
        />

    <Snackbar
      open={successOpen}
      autoHideDuration={3000}
      onClose={handleCloseSnackbar}
      message={successMessage}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
      onClose={handleCloseSnackbar}
      severity="success"
      variant="filled"
      sx={{ width: '100%' }}
    >
      {successMessage}
    </Alert>
    </Snackbar>
  </Box>
);
}