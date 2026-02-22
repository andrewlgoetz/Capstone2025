import * as React from "react";

export default function AddItemModal({
  open,
  onClose,
  onSave,
  defaultValues,
  isSaving,
  mode = "add",
  categories,
  locations = [],
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

      setValues({
        item_id: defaultValues.item_id ?? null,
        name: defaultValues.name ?? "",
        category: defaultValues.category ?? "",
        barcode: defaultValues.barcode ?? "",
        quantity: quantityStr,
        unit: defaultValues.unit ?? "",
        expiration_date: defaultValues.expiration_date
          ? String(defaultValues.expiration_date).split("T")[0] 
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
      setValues({
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
  
  const isTransferMovement =
  isEditMode && !!originalValues && locationChanged;

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

  const movementNeeded = isTransferMovement || isQtyMovement;

  React.useEffect(() => {
    if (!isEditMode || !originalValues) return;
  
    if (isTransferMovement) {
      setValues((v) =>
        v.movement_type === "TRANSFER"
          ? v
          : { ...v, movement_type: "TRANSFER" }
      );
    } else if (isQtyMovement) {
      setValues((v) =>
        v.movement_type === "TRANSFER"
          ? { ...v, movement_type: "" }
          : v
      );
    } else {
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
      location_id:
        values.location_id === "" ? null : Number(values.location_id),
    };
    if (isEditMode && movementNeeded) {
      payload.movement_type = values.movement_type;
      if (values.movement_reason.trim()) {
        payload.movement_reason = values.movement_reason.trim();
      }
    }

    onSave?.({
      mode,                    
      item_id: values.item_id, 
      payload,
    });
  };

  if (!open) return null;

  const inputClass = "w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-slate-500 focus:border-slate-500 transition duration-150 disabled:bg-gray-50 disabled:text-gray-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const selectClass = "appearance-none block w-full p-2 border border-gray-300 bg-white rounded-lg text-sm focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500";
  
  const MovementTypeOptions = (
    <>
      <option value="">Select reason</option>
      <option value="OUTBOUND">Outbound</option>
      <option value="WASTE">Waste</option>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >

        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-slate-800">
            {mode === "add" ? "Add Inventory Item" : "Edit Inventory Item"}
          </h2>
        </div>
        

        {invalidCombinedChange && (
            <div className="p-4 bg-red-50 text-red-700 text-sm border-b border-red-200">
                ⚠️ **Invalid Change:** Cannot change both **Quantity** and **Location** in one edit. Please update one at a time.
            </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto divide-y divide-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div>
                <label htmlFor="name" className={labelClass}>Name <span className="text-red-500">*</span></label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={values.name}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={isEditMode}
                />
              </div>

              <div>
                <label htmlFor="category" className={labelClass}>Category <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    id="category"
                    name="category"
                    required
                    value={values.category}
                    onChange={handleChange}
                    className={selectClass}
                    disabled={isEditMode}
                  >
                    <option value="" disabled>Select category</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="barcode" className={labelClass}>Barcode <span className="text-red-500">*</span></label>
                <input
                  id="barcode"
                  name="barcode"
                  type="text"
                  required
                  value={values.barcode}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={isEditMode}
                />
              </div>

              <div>
                <label htmlFor="quantity" className={labelClass}>Quantity <span className="text-red-500">*</span></label>
                <input
                  id="quantity"
                  name="quantity"
                  type="number"
                  required
                  value={values.quantity}
                  onChange={handleChange}
                  min="0"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="unit" className={labelClass}>Unit (e.g., cans, jars) <span className="text-red-500">*</span></label>
                <input
                  id="unit"
                  name="unit"
                  type="text"
                  required
                  value={values.unit}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={isEditMode}
                />
              </div>

              <div>
                <label htmlFor="expiration_date" className={labelClass}>Expires</label>
                <input
                  id="expiration_date"
                  name="expiration_date"
                  type="date"
                  value={values.expiration_date}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={isEditMode}
                />
              </div>

              <div>
                <label htmlFor="location_id" className={labelClass}>Location <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    id="location_id"
                    name="location_id"
                    required
                    value={values.location_id}
                    onChange={handleChange}
                    className={selectClass}
                  >
                    <option value="" disabled>Select location</option>
                    {locations.map((loc) => (
                      <option key={loc.location_id} value={String(loc.location_id)}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              {isEditMode && movementNeeded && (
                <>
                  <div>
                    <label htmlFor="movement_type" className={labelClass}>Movement Type <span className="text-red-500">*</span></label>
                    <div className="relative">
                      {isTransferMovement ? (
                        <input
                          type="text"
                          value="TRANSFER"
                          disabled
                          className={inputClass}
                        />
                      ) : (
                        <select
                          id="movement_type"
                          name="movement_type"
                          required
                          value={values.movement_type}
                          onChange={handleChange}
                          className={selectClass}
                        >
                          {MovementTypeOptions}
                        </select>
                      )}
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                        {!isTransferMovement && (
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="movement_reason" className={labelClass}>Movement note (optional)</label>
                    <input
                      id="movement_reason"
                      name="movement_reason"
                      type="text"
                      value={values.movement_reason}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg shadow-md hover:bg-slate-700 transition disabled:opacity-50"
            >
              {isSaving
                ? "Saving..."
                : mode === "add"
                ? "Add"
                : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}