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
    movement_type: "",
    movement_reason: "",
  });

  // Track original values when editing an item so we can detect changes
  const [originalValues, setOriginalValues] = React.useState(null);

  React.useEffect(() => {
    if (!open) return;

    if (defaultValues) {
      const quantityStr =
      defaultValues.quantity === null || defaultValues.quantity === undefined
        ? ""
        : String(defaultValues.quantity);

      const locationStr =
        defaultValues.location_id === null || defaultValues.location_id === undefined
          ? ""
          : String(defaultValues.location_id);

      // Map backend row → form values
      setValues({
        item_id: defaultValues.item_id ?? null,
        name: defaultValues.name ?? "",
        category: defaultValues.category ?? "",
        barcode: defaultValues.barcode ?? "",
        quantity: quantityStr,
        unit: defaultValues.unit ?? "",
        expiration_date: defaultValues.expiration_date
          ? String(defaultValues.expiration_date).split("T")[0] // keep YYYY-MM-DD
          : "",
        location_id: locationStr,
        movement_type: "",  // reset movement fields
        movement_reason: "",
      });

      setOriginalValues({
        quantity: quantityStr,
        location_id: locationStr,
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
      setOriginalValues(null);
    }
  }, [defaultValues, open, mode]);


  const isEditMode = mode !== "add";

  const numericQuantity =
    values.quantity === "" ? null : Number(values.quantity);

  const numericOriginalQuantity =
    !originalValues || originalValues.quantity === ""
      ? null
      : Number(originalValues.quantity);

  const locationChanged =
    !!originalValues &&
    originalValues.location_id !== "" &&
    values.location_id !== "" &&
    values.location_id !== originalValues.location_id;

  const quantityDecreased =
    numericQuantity !== null &&
    numericOriginalQuantity !== null &&
    numericQuantity < numericOriginalQuantity;
  
  // location change → transfer movement
  const isTransferMovement =
  isEditMode && !!originalValues && locationChanged;

  // qty decrease only (no location change) → outbound or waste
  const isQtyMovement =
  isEditMode &&
  !!originalValues &&
  quantityDecreased &&
  !locationChanged;

  const invalidCombinedChange =
  isEditMode &&
  !!originalValues &&
  quantityDecreased &&
  locationChanged;

  // We log a movement when quantity decreases OR location changes (in edit mode)
  const movementNeeded = isTransferMovement || isQtyMovement;

  React.useEffect(() => {
    if (!isEditMode || !originalValues) return;
  
    if (isTransferMovement) {
      // auto-lock movement type as TRANSFER
      setValues((v) =>
        v.movement_type === "TRANSFER"
          ? v
          : { ...v, movement_type: "TRANSFER" }
      );
    } else if (isQtyMovement) {
      // if we were previously in transfer mode, clear it so user can pick outbound/waste
      setValues((v) =>
        v.movement_type === "TRANSFER"
          ? { ...v, movement_type: "" }
          : v
      );
    } else {
      // no movement needed → clear movement_type
      setValues((v) =>
        v.movement_type ? { ...v, movement_type: "" } : v
      );
    }
  }, [isEditMode, originalValues, isTransferMovement, isQtyMovement]);
  

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (invalidCombinedChange) {
      alert(
        "Can't change both quantity and location in one edit. Please update one at a time."
      );
      return;
    }

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
    // Only send movement fields when editing AND movement is needed
    if (isEditMode && movementNeeded) {
      payload.movement_type = values.movement_type;
      if (values.movement_reason.trim()) {
        payload.movement_reason = values.movement_reason.trim();
      }
    }

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
                disabled={isEditMode}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth disabled={isEditMode}>
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
                disabled={isEditMode}
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
                disabled={isEditMode}
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
                disabled={isEditMode}
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
            {isEditMode && movementNeeded && (
            <>
              {/* Movement type */}
              <Grid size={{ xs: 12, sm: 6 }}>
                {isTransferMovement ? (
                  // Transfer: lock movement type to TRANSFER
                  <TextField
                    label="Movement Type"
                    value="Transfer"
                    fullWidth
                  />
                ) : (
                  <FormControl fullWidth required>
                    <InputLabel>Movement Type</InputLabel>
                    <Select
                      name="movement_type"
                      label="Movement Type"
                      value={values.movement_type}
                      onChange={handleChange}
                    >
                      <MenuItem value="OUTBOUND">Outbound</MenuItem>
                      <MenuItem value="WASTE">Waste</MenuItem>
                    </Select>
                  </FormControl>
                )}
              </Grid>

              {/* Optional note for any movement */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  name="movement_reason"
                  label="Movement note (optional)"
                  fullWidth
                  value={values.movement_reason}
                  onChange={handleChange}
                />
              </Grid>
            </>
          )}
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
