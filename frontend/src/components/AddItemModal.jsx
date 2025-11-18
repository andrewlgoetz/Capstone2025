import * as React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Grid, Button, FormControl, InputLabel, Select, MenuItem
} from "@mui/material";

export default function AddItemModal({
  open,
  onClose,
  onSave,
  defaultValues,
  isSaving,
  mode = "add",
  categories
}) {
  const [values, setValues] = React.useState({
    item_id: null,
    name: "",
    category: "",
    barcode: "",
    quantity: "",
    unit: "",
    expiration_date: "",
    location_id: "",
  });

  React.useEffect(() => {
    if (!open) return;

    if (defaultValues) {
      // Map backend row → form values
      setValues({
        item_id: defaultValues.item_id ?? null,
        name: defaultValues.name ?? "",
        category: defaultValues.category ?? "",
        barcode: defaultValues.barcode ?? "",
        quantity:
          defaultValues.quantity === null || defaultValues.quantity === undefined
            ? ""
            : String(defaultValues.quantity),
        unit: defaultValues.unit ?? "",
        expiration_date: defaultValues.expiration_date
          ? String(defaultValues.expiration_date).split("T")[0] // keep YYYY-MM-DD
          : "",
        location_id:
          defaultValues.location_id === null ||
          defaultValues.location_id === undefined
            ? ""
            : String(defaultValues.location_id),
      });
    } else {
      // blank form for add mode
      setValues({
        item_id: null,
        name: "",
        category: "",
        barcode: "",
        quantity: "",
        unit: "",
        expiration_date: "",
        location_id: "",
      });
    }
  }, [defaultValues, open, mode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const payload = {
      name: values.name.trim(),
      category: values.category || null,
      barcode: values.barcode || null,
      quantity: Number(values.quantity),
      unit: values.unit || null,
      expiration_date: values.expiration_date || null,
      // "" → null so we don’t send 0 by accident
      location_id:
        values.location_id === "" ? null : Number(values.location_id),
    };

    onSave?.({
      mode,                    // 'add' or 'edit'
      item_id: values.item_id, // used for edit
      payload,
    });
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {mode === "add" ? "Add Inventory Item" : "Edit Inventory Item"}
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                name="name"
                label="Name"
                fullWidth
                required
                type="string"
                value={values.name}
                onChange={handleChange}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                name="category"
                label="Category"
                required
                value={values.category}
                onChange={handleChange}
              >
                {categories.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                name="barcode"
                label="Barcode"
                fullWidth
                required
                value={values.barcode}
                onChange={handleChange}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                name="quantity"
                label="Quantity"
                fullWidth
                required
                type="number"
                value={values.quantity}
                onChange={handleChange}
                inputProps={{ min: 0 }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                name="unit"
                label="Unit (e.g., cans, jars)"
                fullWidth
                required
                type="string"
                value={values.unit}
                onChange={handleChange}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                name="expiration_date"
                label="Expires"
                type="date"
                fullWidth
                value={values.expiration_date}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                name="location_id"
                label="Location ID"
                type="number"
                fullWidth
                required
                value={values.location_id}
                onChange={handleChange}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit" disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSaving}>
            {isSaving
              ? "Saving..."
              : mode === "add"
              ? "Add"
              : "Save changes"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
