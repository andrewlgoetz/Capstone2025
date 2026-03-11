import * as React from "react";
import { useQuery } from '@tanstack/react-query';
import { fetchInventoryByBarcode, getCategories } from "../services/api";

// Fallback categories if database fetch fails
const FALLBACK_CATEGORY_OPTIONS = [
  'Produce',
  'Meat & Seafood',
  'Dairy',
  'Eggs',
  'Bakery & Bread',
  'Frozen Foods',
  'Beverages',
  'Pantry Staples',
  'Canned Goods',
  'Snacks',
  'Condiments & Sauces',
  'Grains & Pasta',
  'Breakfast & Cereal',
  'Household',
  'Personal Care',
  'Cleaning Supplies',
  'Baby Products',
  'Pet Supplies',
  'Health & Medicine',
  'Other',
];

const UNIT_OPTIONS = [
  'units',
  'kg',
  'g',
  'lbs',
  'oz',
  'cups',
  'ml',
  'L',
  'packs',
  'boxes',
  'bags',
  'bottles',
  'cans',
  'cartons',
  'blocks',
  'pieces',
  'dozen',
  'trays',
  'rolls',
  'sachets',
  'Custom',
];

export default function AddItemModal({
  open,
  onClose,
  onSave,
  defaultValues,
  isSaving,
  mode = "add",
  locations = [],
}) {
  // Fetch categories from API
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  // Process categories: filter active ones
  const CATEGORY_OPTIONS = React.useMemo(() => {
    if (!categoriesQuery.data) {
      return FALLBACK_CATEGORY_OPTIONS;
    }
    return categoriesQuery.data
      .filter(cat => cat.is_active)
      .map(cat => cat.name);
  }, [categoriesQuery.data]);

  const [values, setValues] = React.useState({
    item_id: null,
    name: "",
    category: "",
    barcode: "",
    quantity: "",
    unit: "units",
    expiration_date: "",
    location_id: "",
    movement_type: "",
    movement_reason: "",
  });

  const [customUnit, setCustomUnit] = React.useState("");
  const [customCategory, setCustomCategory] = React.useState("");
  const [barcodeStatus, setBarcodeStatus] = React.useState(null); // null | 'KNOWN' | 'NEW'
  const [barcodeLoading, setBarcodeLoading] = React.useState(false);
  const barcodeTimerRef = React.useRef(null);

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
        movement_type: "",
        movement_reason: "",
      });

      setCustomUnit("");
      setCustomCategory("");
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
        unit: "units",
        expiration_date: "",
        location_id: "",
        movement_type: "",
        movement_reason: "",
      });
      setCustomUnit("");
      setCustomCategory("");
      setOriginalValues(null);
      setBarcodeStatus(null);
    }
  }, [defaultValues, open, mode]);

  const isEditMode = mode !== "add";

  // Barcode lookup with debounce (add mode only)
  const handleBarcodeChange = (e) => {
    const barcode = e.target.value;
    setValues((v) => ({ ...v, barcode }));
    setBarcodeStatus(null);

    if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
    if (!barcode || barcode.length < 4) return;

    barcodeTimerRef.current = setTimeout(async () => {
      setBarcodeLoading(true);
      try {
        const result = await fetchInventoryByBarcode(barcode);
        if (result) {
          const status = result.item_id ? "KNOWN" : "NEW";
          setBarcodeStatus(status);

          const rawUnit = result.raw?.unit || "";
          const rawCategory = result.category || "";

          setValues((v) => ({
            ...v,
            name: v.name || result.name || "",
            category: (() => {
              if (v.category) return v.category;
              if (!rawCategory) return "";
              return CATEGORY_OPTIONS.includes(rawCategory)
                ? rawCategory
                : "Other";
            })(),
            unit: (() => {
              if (v.unit && v.unit !== "units") return v.unit;
              if (!rawUnit) return "units";
              return UNIT_OPTIONS.slice(0, -1).includes(rawUnit)
                ? rawUnit
                : "Custom";
            })(),
          }));

          if (rawCategory && !CATEGORY_OPTIONS.includes(rawCategory)) {
            setCustomCategory(rawCategory);
          }
          if (rawUnit && !UNIT_OPTIONS.slice(0, -1).includes(rawUnit)) {
            setCustomUnit(rawUnit);
          }
        }
      } catch {
        // silent — lookup failure shouldn't block the user
      } finally {
        setBarcodeLoading(false);
      }
    }, 600);
  };

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

  const isTransferMovement = isEditMode && !!originalValues && locationChanged;
  const isQtyMovement =
    isEditMode && !!originalValues && quantityDecreased && !locationChanged;
  const invalidCombinedChange =
    isEditMode && !!originalValues && quantityDecreased && locationChanged;
  const movementNeeded = isTransferMovement || isQtyMovement;

  React.useEffect(() => {
    if (!isEditMode || !originalValues) return;
    if (isTransferMovement) {
      setValues((v) =>
        v.movement_type === "TRANSFER" ? v : { ...v, movement_type: "TRANSFER" }
      );
    } else if (isQtyMovement) {
      setValues((v) =>
        v.movement_type === "TRANSFER" ? { ...v, movement_type: "" } : v
      );
    } else {
      setValues((v) => (v.movement_type ? { ...v, movement_type: "" } : v));
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

    const resolvedUnit =
      values.unit === "Custom" ? customUnit.trim() || null : values.unit || null;
    const resolvedCategory =
      values.category === "Other"
        ? customCategory.trim() || null
        : values.category || null;

    const payload = {
      name: values.name.trim(),
      category: resolvedCategory,
      barcode: values.barcode || null,
      quantity: Number(values.quantity),
      unit: resolvedUnit,
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

    onSave?.({ mode, item_id: values.item_id, payload });
  };

  if (!open) return null;

  const inputClass =
    "w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-slate-500 focus:border-slate-500 transition duration-150 disabled:bg-gray-50 disabled:text-gray-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const selectClass =
    "appearance-none block w-full p-2 border border-gray-300 bg-white rounded-lg text-sm focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500";
  const chevron = (
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
      </svg>
    </div>
  );

  const MovementTypeOptions = (
    <>
      <option value="">Select reason</option>
      <option value="OUTBOUND">Outbound</option>
      <option value="WASTE">Waste</option>
    </>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-slate-800">
            {mode === "add" ? "Add Inventory Item" : "Edit Inventory Item"}
          </h2>
        </div>

        {invalidCombinedChange && (
          <div className="p-4 bg-red-50 text-red-700 text-sm border-b border-red-200">
            ⚠️ Cannot change both Quantity and Location in one edit. Please update one at a time.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto divide-y divide-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Name */}
              <div>
                <label htmlFor="name" className={labelClass}>
                  Name <span className="text-red-500">*</span>
                </label>
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

              {/* Category */}
              <div>
                <label htmlFor="category" className={labelClass}>
                  Category <span className="text-red-500">*</span>
                </label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={values.category}
                    disabled
                    className={inputClass}
                  />
                ) : (
                  <>
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
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      {chevron}
                    </div>
                    {values.category === "Other" && (
                      <input
                        type="text"
                        placeholder="Enter custom category"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className={`${inputClass} mt-2`}
                        required
                      />
                    )}
                  </>
                )}
              </div>

              {/* Barcode */}
              <div>
                <label htmlFor="barcode" className={labelClass}>
                  Barcode <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="barcode"
                    name="barcode"
                    type="text"
                    required
                    value={values.barcode}
                    onChange={isEditMode ? handleChange : handleBarcodeChange}
                    className={inputClass}
                    disabled={isEditMode}
                    placeholder={isEditMode ? "" : "Scan or type barcode…"}
                  />
                  {barcodeLoading && (
                    <div className="absolute inset-y-0 right-2 flex items-center">
                      <span className="text-xs text-gray-400 animate-pulse">Looking up…</span>
                    </div>
                  )}
                </div>
                {!isEditMode && barcodeStatus === "KNOWN" && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠ Barcode already in inventory — fields pre-filled from existing item
                  </p>
                )}
                {!isEditMode && barcodeStatus === "NEW" && (
                  <p className="text-xs text-emerald-600 mt-1">
                    ✓ Product found — fields pre-filled from product database
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label htmlFor="quantity" className={labelClass}>
                  Quantity <span className="text-red-500">*</span>
                </label>
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
                <label htmlFor="unit" className={labelClass}>
                  Unit <span className="text-red-500">*</span>
                </label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={values.unit}
                    disabled
                    className={inputClass}
                  />
                ) : (
                  <>
                    <div className="relative">
                      <select
                        id="unit"
                        name="unit"
                        required
                        value={values.unit}
                        onChange={handleChange}
                        className={selectClass}
                      >
                        <option value="" disabled>Select unit</option>
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      {chevron}
                    </div>
                    {values.unit === "Custom" && (
                      <input
                        type="text"
                        placeholder="Enter custom unit"
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value)}
                        className={`${inputClass} mt-2`}
                        required
                      />
                    )}
                  </>
                )}
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
                  disabled={isEditMode}
                />
              </div>

              {/* Location */}
              <div>
                <label htmlFor="location_id" className={labelClass}>
                  Location <span className="text-red-500">*</span>
                </label>
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
                  {chevron}
                </div>
              </div>

              {/* Movement fields (edit mode only) */}
              {isEditMode && movementNeeded && (
                <>
                  <div>
                    <label htmlFor="movement_type" className={labelClass}>
                      Movement Type <span className="text-red-500">*</span>
                    </label>
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
                      {!isTransferMovement && chevron}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="movement_reason" className={labelClass}>
                      Movement note (optional)
                    </label>
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
              {isSaving ? "Saving..." : mode === "add" ? "Add" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
