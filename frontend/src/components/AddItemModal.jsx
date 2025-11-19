import { useState, useEffect } from "react";
// Removed all MUI imports

export default function AddItemModal({
  open,
  onClose,
  onSave,
  defaultValues,
  isSaving,
  mode = "add",
  categories
}) {
  const [values, setValues] = useState({
    item_id: null,
    name: "",
    category: "",
    barcode: "",
    quantity: "",
    unit: "",
    expiration_date: "",
    location_id: "",
  });

  useEffect(() => {
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

  const inputClass = "w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-slate-500 focus:border-slate-500 transition duration-150";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const selectClass = "appearance-none block w-full p-2 border border-gray-300 bg-white rounded-lg text-sm focus:border-slate-500";
  
  return (
    // Tailwind Modal Overlay (Fixed position, full screen)
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      
      {/* Modal Card (White background, centered, shadow) */}
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        
        {/* Dialog Title */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-slate-800">
            {mode === "add" ? "Add Inventory Item" : "Edit Inventory Item"}
          </h2>
        </div>
        
        <form onSubmit={handleSubmit}>
          {/* Dialog Content */}
          <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto divide-y divide-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Name */}
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
                />
              </div>

              {/* Category Select */}
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

              {/* Barcode */}
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
                />
              </div>

              {/* Quantity */}
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

              {/* Unit */}
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
                />
              </div>

              {/* Expiration Date */}
              <div>
                <label htmlFor="expiration_date" className={labelClass}>Expires</label>
                <input
                  id="expiration_date"
                  name="expiration_date"
                  type="date"
                  value={values.expiration_date}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              {/* Location ID */}
              <div>
                <label htmlFor="location_id" className={labelClass}>Location ID <span className="text-red-500">*</span></label>
                <input
                  id="location_id"
                  name="location_id"
                  type="number"
                  required
                  value={values.location_id}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
          
          {/* Dialog Actions */}
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