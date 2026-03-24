import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createItem, getCategories } from '../../services/api';
import CategorySearch from '../CategorySearch';

const UNIT_OPTIONS = [
  'units', 'kg', 'g', 'lbs', 'oz', 'cups', 'ml', 'L',
  'packs', 'boxes', 'bags', 'bottles', 'cans', 'cartons',
  'blocks', 'pieces', 'dozen', 'trays', 'rolls', 'sachets', 'CUSTOM'
];

export default function CheckInNewItemModal({
  open,
  onClose,
  onConfirm,
  initial = {},
  imageUrl,
  product = null,
  locations = [],
}) {
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const categories = useMemo(() => {
    return (categoriesQuery.data || [])
      .filter((cat) => cat.is_active)
      .map((cat) => cat.name);
  }, [categoriesQuery.data]);

  const [form, setForm] = useState({
    barcode: '',
    quantity: '',
    name: '',
    category: '',
    expiry_date: '',
    unit: 'units',
    custom_unit: '',
    location_id: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;

    const autoLocation =
      initial.location_id != null
        ? String(initial.location_id)
        : locations.length === 1
        ? String(locations[0].location_id)
        : '';

    setForm({
      barcode: initial.barcode || '',
      quantity: initial.quantity ?? '',
      name: initial.name || product?.name || '',
      category: initial.category || product?.category || '',
      expiry_date: initial.expiry_date || '',
      unit: initial.unit || 'units',
      custom_unit: '',
      location_id: autoLocation,
    });

    setSaving(false);
    setError(null);
  }, [open, initial, product, locations]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleConfirm = async () => {
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    const quantityToCheckIn = Number(form.quantity) || 0;
    if (quantityToCheckIn <= 0) {
      setError('Quantity must be greater than 0.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const unitToSend = form.unit === 'CUSTOM' ? (form.custom_unit || null) : form.unit;

      const payload = {
        barcode: form.barcode || null,
        quantity: 0, // IMPORTANT: create shell only, do not add stock here
        name: form.name.trim(),
        category: form.category || null,
        unit: unitToSend,
        expiration_date: form.expiry_date || null,
        location_id: form.location_id ? Number(form.location_id) : null,
      };

      const created = await createItem(payload);

      onConfirm?.({
        createdItem: created,
        quantityToCheckIn,
      });

      onClose?.();
    } catch (err) {
      console.error('Create item failed', err);
      const detail = err?.response?.data?.detail || err?.message || 'Create failed';
      setError(detail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(open)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className="text-xl font-semibold text-slate-800 tracking-tight">
        Add New Item for Check In
      </DialogTitle>

      <DialogContent className="bg-white p-4 rounded-xl shadow-lg border border-gray-200">
        <Box className="flex gap-2 flex-col sm:flex-row">
          <Box sx={{ flex: '0 0 160px', display: 'grid', placeItems: 'center' }}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={form.name || 'item image'}
                style={{ width: 150, height: 220, objectFit: 'cover', borderRadius: 8 }}
              />
            ) : (
              <Box sx={{ width: 150, height: 220, bgcolor: '#f3f4f6', borderRadius: 1 }} />
            )}
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Barcode" value={form.barcode} InputProps={{ readOnly: true }} />

            <TextField
              label="Quantity to check in"
              value={form.quantity}
              onChange={handleChange('quantity')}
              inputProps={{ inputMode: 'numeric' }}
              autoFocus
            />

            <FormControl fullWidth>
              <InputLabel id="checkin-unit-select-label">Unit</InputLabel>
              <Select
                labelId="checkin-unit-select-label"
                value={form.unit}
                label="Unit"
                onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
              >
                {UNIT_OPTIONS.map((u) => (
                  <MenuItem key={u} value={u}>
                    {u}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {form.unit === 'CUSTOM' && (
              <TextField
                label="Custom unit"
                value={form.custom_unit}
                onChange={handleChange('custom_unit')}
                fullWidth
              />
            )}

            <TextField label="Name" value={form.name} onChange={handleChange('name')} />

            <div>
              <Typography variant="caption" color="textSecondary" sx={{ mb: 0.5, display: 'block' }}>
                Category
              </Typography>
              <CategorySearch
                categories={categories}
                value={form.category || ''}
                onChange={(cat) => setForm((prev) => ({ ...prev, category: cat }))}
                placeholder="Search categories…"
                inputClassName="border border-gray-300"
              />
            </div>

            <TextField
              label="Expiry date"
              value={form.expiry_date}
              onChange={handleChange('expiry_date')}
              placeholder="YYYY-MM-DD"
            />

            {locations.length > 1 && (
              <FormControl fullWidth>
                <InputLabel id="checkin-location-select-label">Location</InputLabel>
                <Select
                  labelId="checkin-location-select-label"
                  value={form.location_id}
                  label="Location"
                  onChange={(e) => setForm((prev) => ({ ...prev, location_id: e.target.value }))}
                >
                  {locations.map((loc) => (
                    <MenuItem key={loc.location_id} value={String(loc.location_id)}>
                      {loc.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {error && <Typography variant="body2" color="error">{error}</Typography>}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <div className="w-full flex justify-end gap-2 px-4 pb-4">
          <button
            type="button"
            className="px-4 py-2 rounded hover:bg-gray-100 text-slate-700 font-medium"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className={`px-4 py-2 rounded ${
              saving ? 'opacity-50 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </DialogActions>
    </Dialog>
  );
}