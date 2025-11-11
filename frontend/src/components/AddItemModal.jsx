import * as React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Grid, Button
} from "@mui/material";

export default function AddItemModal({ open, onClose, onSave, defaultValues }) {
  const [values, setValues] = React.useState({
    name: "",               // required
    category: "",
    barcode: "",
    quantity: "",           // required (number)
    unit: "",
    expiration_date: "",    // "YYYY-MM-DD"
    location_id: "",
  });

  React.useEffect(() => {
    // Prefill when opening or when defaults change
    setValues(v => ({ ...v, ...(defaultValues || {}) }));
  }, [defaultValues, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues(v => ({ ...v, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Build payload matching your backend expectations
    const payload = {
      name: values.name.trim(),
      category: values.category,
      barcode: values.barcode,
      quantity: Number(values.quantity),
      unit: values.unit,
      expiration_date: values.expiration_date,
      location_id: values.location_id === "" ? null : Number(values.location_id),
    };

    onSave?.(payload);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Inventory Item</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                name="name" label="Name" fullWidth required type="string"
                value={values.name} onChange={handleChange}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                name="category" label="Category" fullWidth type="string"
                value={values.category} onChange={handleChange}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                name="barcode" label="Barcode" fullWidth
                value={values.barcode} onChange={handleChange}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                name="quantity" label="Quantity" fullWidth type="number"
                value={values.quantity} onChange={handleChange}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                name="unit" label="Unit (e.g., cans, jars)" fullWidth type="string"
                value={values.unit} onChange={handleChange}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                name="expiration_date" label="Expires" type="date" fullWidth
                value={values.expiration_date} onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                name="location_id" label="Location ID" type="number" fullWidth
                value={values.location_id} onChange={handleChange}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit">Cancel</Button>
          <Button type="submit" variant="contained">Save</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
