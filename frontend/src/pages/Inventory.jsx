import { useState, useEffect } from 'react';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

import { useMutation, useQueryClient } from '@tanstack/react-query'
import InventoryTable from '../components/InventoryTable'
import AddItemModal from '../components/AddItemModal'
import { createItem, updateItem, deleteItem } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

export default function Inventory() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('inventory:create')
  const canEdit = hasPermission('inventory:edit')
  const canDelete = hasPermission('inventory:delete')

  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' });
  const [categories, setCategories] = useState([]);

  const closeModal = () => {
    setOpen(false);
    setEditItem(null);
  };

   useEffect(() => {
    if (snack.open) {
      const timer = setTimeout(() => {
        handleCloseSnackbar();
      }, 3000); // Hide after 3 seconds
      
      return () => clearTimeout(timer);
    }
  }, [snack.open]);

  // ------ shared success + error handlers ------
  const handleMutationSuccess = (action) => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    setSnack({ open: true, message: `Item ${action} successfully!`, severity: 'success' });
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

  const handleCloseSnackbar = () => {
    setSnack((s) => ({ ...s, open: false }));
  };

   // ------ mutations ------
   const addItemMutation = useMutation({
    mutationFn: createItem,
    onSuccess: () => handleMutationSuccess("added"),
    onError: (error, variables) => handleMutationError(error, variables),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ item_id, payload }) => updateItem(item_id, payload),
    onSuccess: () => handleMutationSuccess("updated"),
    onError: (error, variables) => handleMutationError(error, variables),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (item_id) => deleteItem(item_id),
    onSuccess: () => handleMutationSuccess("deleted"),
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
          {canCreate && (
            <button
              className="flex items-center gap-1 px-4 py-2 bg-slate-800 text-white rounded-lg font-medium shadow-md hover:bg-slate-700 transition"
              onClick={handleAddClick}
            >
              <AddIcon fontSize="small" />
              Add Item
            </button>
          )}
        </header>

        {/* Inventory Table */}
        <InventoryTable
          mode="full"
          lowStockThreshold={25}
          showFilterBar
          onEditClick={canEdit ? handleEditClick : null}
          onDeleteClick={canDelete ? handleDeleteClick : null}
          onCategoriesLoaded={(cats) => setCategories(cats)}
        />

        {/* Add/Edit Modal (Assumes AddItemModal uses Tailwind) */}
        <AddItemModal
          open={open}
          onClose={closeModal}
          onSave={handleSave}
          isSaving={isSaving}
          mode={editItem ? 'edit' : 'add'}
          defaultValues={editItem}
          categories={categories}
        />
        {snack.open && (
          <div 
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-300"
          >
            <div 
              className={`p-3 text-sm rounded-lg shadow-xl flex items-center justify-between gap-4 ${
                snack.severity === 'success' ? 'bg-emerald-600 text-white' : 
                snack.severity === 'warning' ? 'bg-amber-500 text-slate-900' : 'bg-slate-600 text-white'
              }`}
            >
              <p>{snack.message}</p>
              <button 
                className="opacity-70 hover:opacity-100" 
                onClick={handleCloseSnackbar}
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
    </div>
  </div>
);
}