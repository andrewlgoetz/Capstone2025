import { useMemo, useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";

import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SortIcon from "@mui/icons-material/Sort";
import api, { getCategories } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import CategorySearch from "./CategorySearch";


const formatDate = (dateString) => {
  if (!dateString) return "—";
  return String(dateString).split("T")[0];
};

const EXPIRING_SOON_DAYS = 30;

const inNextNDays = (dateStr, n) => {
  if (!dateStr || !n) return false;
  const d = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + Number(n));
  return d >= today && d <= limit;
};

// Default columns mapping to backend inventory table
const DEFAULT_COLUMNS = [
  { accessorKey: "item_id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "category", header: "Category" },
  { accessorKey: "barcode", header: "Barcode" },
  { accessorKey: "quantity", header: "Qty" },
  { accessorKey: "unit", header: "Unit" },
  {
    accessorKey: "expiration_date",
    header: "Expires",
    cell: ({ cell }) => formatDate(cell.getValue()),
  },
  {
    accessorKey: "location_id",
    header: "Location",
    cell: ({ cell, table }) => {
      const locs = table.options.meta?.locations;
      return locs?.find((l) => l.location_id === cell.getValue())?.name || cell.getValue();
    },
  },
  {
    accessorKey: "date_added",
    header: "Date Added",
    cell: ({ cell }) => formatDate(cell.getValue()),
  },
  {
    accessorKey: "last_modified",
    header: "Date Modified",
    cell: ({ cell }) => formatDate(cell.getValue()),
  },
];

export default function InventoryTable({
  mode = "full", // "full" or "widget"
  limit = 5, // max rows in widget mode
  showColumns = null, // array of accessorKeys to show
  lowStockThreshold = 10,
  showFilterBar = true,
  locationIds = null, // optional location filter
  onEditClick = null,
  onDeleteClick = null,
  onCategoriesLoaded = null,
}) {
  const [sorting, setSorting] = useState(
    mode === "widget" ? [{ id: "last_modified", desc: true }] : []
  );
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [expiryFrom, setExpiryFrom] = useState("");
  const [expiryTo, setExpiryTo] = useState("");
  const [onlyWithExpiry, setOnlyWithExpiry] = useState(false);
  const [expiringInDays, setExpiringInDays] = useState("");

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: mode === "widget" ? limit : 10,
  });

  // Grouped view state
  const [groupView, setGroupView] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  const { hasPermission, userLocations } = useAuth();

  const query = useQuery({
    queryKey: ["inventory", { mode, locationIds }],
    queryFn: async () => {
      const params = locationIds?.length ? { location_ids: locationIds.join(',') } : {};
      const res = await api.get("/inventory/all", { params });
      return res.data;
    },
    enabled: hasPermission('inventory:view'),
  });

  const rawItems = query.data ?? [];

  const masterSequentialItems = useMemo(
      () => [...rawItems].sort((a, b) => a.item_id - b.item_id),
      [rawItems]
    );

  const items = useMemo(() => {
    if (mode === "widget") {
      return [...rawItems].sort((a, b) => {
        const dateA = a.last_modified ? new Date(a.last_modified) : new Date(0);
        const dateB = b.last_modified ? new Date(b.last_modified) : new Date(0);
        return dateB - dateA;
      });
    }
    return masterSequentialItems;
  }, [rawItems, mode, masterSequentialItems]);

  const isLoading = query.isLoading;
  const isError = query.isError;

  const [serialMap, setSerialMap] = useState({});

  useEffect(() => {
    if (!masterSequentialItems.length) {
      setSerialMap({});
      return;
    }
    const next = {};
    let serial = 1;
    masterSequentialItems.forEach((item) => {
      next[item.item_id] = serial++;
    });
    setSerialMap(next);
  }, [masterSequentialItems]);

  // Decide which columns to render (item view)
  const effectiveColumns = useMemo(() => {
    const serialCol = {
      id: "serial",
      header: "No.",
      enableSorting: false,
      cell: ({ row }) => serialMap[row.original.item_id] ?? "—",
    };

    let cols = DEFAULT_COLUMNS.filter((c) => c.accessorKey !== "item_id");

    if (mode === "widget") {
      cols = cols.filter((c) =>
        ["name", "quantity", "unit", "last_modified"].includes(c.accessorKey)
      );
    }
    if (Array.isArray(showColumns) && showColumns.length > 0) {
      cols = cols.filter((c) => showColumns.includes(c.accessorKey));
    }

    const hasActions = onEditClick || onDeleteClick;
    const actionsCol = {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          {onEditClick && (
            <button
              title="Edit item"
              className="p-1 rounded-full text-slate-600 hover:bg-gray-100"
              onClick={(e) => { e.stopPropagation(); onEditClick(row.original); }}
            >
              <EditIcon fontSize="small" />
            </button>
          )}
          {onDeleteClick && (
            <button
              title="Delete item"
              className="p-1 rounded-full text-red-600 hover:bg-red-50"
              onClick={(e) => { e.stopPropagation(); onDeleteClick(row.original); }}
            >
              <DeleteIcon fontSize="small" />
            </button>
          )}
        </div>
      ),
    };

    const baseCols = [serialCol, ...cols].map((c) => ({
      ...c,
      cell: c.cell || ((info) => info.getValue()),
    }));

    return mode === "full" && hasActions ? [...baseCols, actionsCol] : baseCols;
  }, [mode, showColumns, serialMap, onEditClick, onDeleteClick]);

  const displayed = useMemo(() => {
    return mode === "widget" ? items.slice(0, limit) : items;
  }, [mode, items, limit]);

  // Categories
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const categories = useMemo(() => {
    return (categoriesQuery.data || [])
      .filter(cat => cat.is_active)
      .map(cat => cat.name);
  }, [categoriesQuery.data]);

  useEffect(() => {
    if (onCategoriesLoaded && categories.length > 0) {
      onCategoriesLoaded(categories);
    }
  }, [categories, onCategoriesLoaded]);

  // Date helpers
  const parseYMD = (s) => (s ? new Date(`${s}T00:00:00`) : null);

  // Filtered items (shared by both views)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = parseYMD(expiryFrom);
    const to = parseYMD(expiryTo);

    return displayed.filter((r) => {
      const matchesText =
        !q ||
        [r.name, r.category, r.barcode, r.location_id]
          .map((v) => String(v ?? "").toLowerCase())
          .some((txt) => txt.includes(q));

      const matchesCategory = !categoryFilter || r.category === categoryFilter;
      const matchesLowStock =
        !lowStockOnly || Number(r.quantity ?? 0) <= lowStockThreshold;

      const hasExpiry = !!r.expiration_date;
      if (onlyWithExpiry && !hasExpiry) return false;

      let matchesDateRange = true;
      if (from && hasExpiry)
        matchesDateRange = matchesDateRange && new Date(`${r.expiration_date}T00:00:00`) >= from;
      if (to && hasExpiry)
        matchesDateRange = matchesDateRange && new Date(`${r.expiration_date}T00:00:00`) <= to;
      if ((from || to) && !hasExpiry) matchesDateRange = false;

      const matchesExpiringSoon =
        !expiringInDays || inNextNDays(r.expiration_date, expiringInDays);

      return matchesText && matchesCategory && matchesLowStock && matchesDateRange && matchesExpiringSoon;
    });
  }, [
    displayed, search, categoryFilter, lowStockOnly, lowStockThreshold,
    expiryFrom, expiryTo, onlyWithExpiry, expiringInDays,
  ]);

  // --- Grouped view data ---
  const groupedData = useMemo(() => {
    const groups = {};
    filtered.forEach((item) => {
      const cat = item.category || "Uncategorized";
      if (!groups[cat]) {
        groups[cat] = { category: cat, items: [], units: new Set(), totalQty: 0, lowStockCount: 0, expiringSoonCount: 0 };
      }
      const g = groups[cat];
      g.items.push(item);
      if (item.unit) g.units.add(item.unit);
      g.totalQty += Number(item.quantity ?? 0);
      if (Number(item.quantity ?? 0) <= lowStockThreshold) g.lowStockCount++;
      if (inNextNDays(item.expiration_date, EXPIRING_SOON_DAYS)) g.expiringSoonCount++;
    });
    return Object.values(groups).sort((a, b) => a.category.localeCompare(b.category));
  }, [filtered, lowStockThreshold]);

  const toggleCategory = (cat) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const allExpanded = groupedData.length > 0 && groupedData.every((g) => expandedCategories.has(g.category));
  const toggleAllCategories = () => {
    if (allExpanded) {
      setExpandedCategories(new Set());
    } else {
      setExpandedCategories(new Set(groupedData.map((g) => g.category)));
    }
  };

  // TanStack table (item view)
  const table = useReactTable({
    data: filtered,
    columns: effectiveColumns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    defaultColumn: { cell: (info) => String(info.getValue() ?? "—") },
    meta: { locations: userLocations },
  });

  const thClass = "px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider";
  const tdClass = "px-4 py-2 whitespace-nowrap text-slate-700";

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-x-auto">
      {isLoading && <div className="h-0.5 w-full bg-blue-500 animate-pulse" />}

      {showFilterBar && mode === "full" && (
        <div className="flex flex-wrap gap-3 items-center p-3 border-b border-gray-200">
          {/* Search Input */}
          <input
            type="text"
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-48 focus:border-slate-500"
            placeholder="Search name, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {/* Category Filter */}
          <div className="w-56">
            <CategorySearch
              categories={categories}
              value={categoryFilter}
              onChange={(cat) => setCategoryFilter(cat)}
              placeholder="All categories…"
              inputClassName="py-1.5 px-3"
            />
          </div>
          <label className="flex items-center text-sm text-slate-700">
            <input
              type="checkbox"
              className="rounded text-slate-600 border-gray-300 mr-2"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
            />
            Low stock (≤ {lowStockThreshold})
          </label>

          <div className="relative">
            <label className="text-xs absolute -top-2 left-2 px-1 bg-white text-gray-500">Expiry from</label>
            <input
              type="date"
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-36 mt-2 focus:border-slate-500"
              value={expiryFrom}
              onChange={(e) => setExpiryFrom(e.target.value)}
            />
          </div>

          <div className="relative">
            <label className="text-xs absolute -top-2 left-2 px-1 bg-white text-gray-500">Expiry to</label>
            <input
              type="date"
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-36 mt-2 focus:border-slate-500"
              value={expiryTo}
              onChange={(e) => setExpiryTo(e.target.value)}
            />
          </div>

          <input
            type="number"
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-32 focus:border-slate-500"
            placeholder="Expiring in (days)"
            min="1"
            value={expiringInDays}
            onChange={(e) => setExpiringInDays(e.target.value)}
          />

          <label className="flex items-center text-sm text-slate-700">
            <input
              type="checkbox"
              className="rounded text-slate-600 border-gray-300 mr-2"
              checked={onlyWithExpiry}
              onChange={(e) => setOnlyWithExpiry(e.target.checked)}
            />
            Only with expiry
          </label>

          {/* View toggle — right-aligned */}
          <div className="ml-auto flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            <button
              className={`px-3 py-1.5 font-medium transition ${!groupView ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-gray-50"}`}
              onClick={() => setGroupView(false)}
            >
              Items
            </button>
            <button
              className={`px-3 py-1.5 font-medium transition border-l border-gray-300 ${groupView ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-gray-50"}`}
              onClick={() => setGroupView(true)}
            >
              By Category
            </button>
          </div>
        </div>
      )}

      {/* ── GROUPED VIEW ─────────────────────────────────────────────────────── */}
      {groupView && mode === "full" ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {/* expand toggle header — click to expand/collapse all */}
                <th className={`${thClass} w-8`}>
                  <button
                    onClick={toggleAllCategories}
                    title={allExpanded ? "Collapse all" : "Expand all"}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    {allExpanded ? "▼" : "▶"}
                  </button>
                </th>
                <th className={thClass}>Category</th>
                <th className={`${thClass} text-center`}>SKUs</th>
                <th className={`${thClass} text-center`}>Total Qty</th>
                <th className={`${thClass} text-center`}>Low Stock</th>
                <th className={`${thClass} text-center`}>Expiring ≤{EXPIRING_SOON_DAYS}d</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-sm">
              {groupedData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">No items match the current filters.</td>
                </tr>
              )}
              {groupedData.map((group) => {
                const isExpanded = expandedCategories.has(group.category);
                const unitList = [...group.units];
                const qtyDisplay = unitList.length === 1
                  ? `${group.totalQty} ${unitList[0]}`
                  : `${group.totalQty} (mixed)`;

                return (
                  <>
                    {/* ── Category header row ── */}
                    <tr
                      key={`group-${group.category}`}
                      className="bg-slate-50 hover:bg-slate-100 cursor-pointer select-none"
                      onClick={() => toggleCategory(group.category)}
                    >
                      <td className={`${tdClass} text-slate-400 text-xs`}>
                        {isExpanded ? "▼" : "▶"}
                      </td>
                      <td className={`${tdClass} font-semibold text-slate-800`}>
                        {group.category}
                      </td>
                      <td className={`${tdClass} text-center text-slate-600`}>
                        {group.items.length}
                      </td>
                      <td className={`${tdClass} text-center text-slate-600`}>
                        {qtyDisplay}
                      </td>
                      <td className={`${tdClass} text-center`}>
                        {group.lowStockCount > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            {group.lowStockCount}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className={`${tdClass} text-center`}>
                        {group.expiringSoonCount > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            {group.expiringSoonCount}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>

                    {/* ── Expanded item rows ── */}
                    {isExpanded && group.items.map((item) => {
                      const locName = userLocations?.find((l) => l.location_id === item.location_id)?.name ?? item.location_id ?? "—";
                      return (
                        <tr key={`item-${item.item_id}`} className="hover:bg-gray-50 border-t border-gray-100">
                          <td className={tdClass} />
                          <td className={`${tdClass} pl-8 text-slate-500`}>
                            <span className="text-xs text-slate-400 mr-2">#{serialMap[item.item_id] ?? "—"}</span>
                            {item.name}
                          </td>
                          <td className={`${tdClass} text-center`}>
                            <span className="font-mono text-xs text-slate-400">{item.barcode ?? "—"}</span>
                          </td>
                          <td className={`${tdClass} text-center`}>
                            {item.quantity} {item.unit}
                          </td>
                          <td className={`${tdClass} text-center`}>
                            {item.quantity <= lowStockThreshold ? (
                              <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-700">low</span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className={`${tdClass} text-center text-slate-500 text-xs`}>
                            {item.expiration_date ? formatDate(item.expiration_date) : "—"}
                            {inNextNDays(item.expiration_date, EXPIRING_SOON_DAYS) && (
                              <span className="ml-1 text-red-500">⚠</span>
                            )}
                          </td>
                          {(onEditClick || onDeleteClick) && (
                            <td className={tdClass}>
                              <div className="flex gap-1 justify-end">
                                {onEditClick && (
                                  <button
                                    title="Edit item"
                                    className="p-1 rounded-full text-slate-500 hover:bg-gray-100"
                                    onClick={(e) => { e.stopPropagation(); onEditClick(item); }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </button>
                                )}
                                {onDeleteClick && (
                                  <button
                                    title="Delete item"
                                    className="p-1 rounded-full text-red-500 hover:bg-red-50"
                                    onClick={(e) => { e.stopPropagation(); onDeleteClick(item); }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>
          <div className="p-3 border-t border-gray-200 text-xs text-slate-400">
            {groupedData.length} categories · {filtered.length} items
          </div>
        </div>
      ) : (
        /* ── ITEM VIEW (existing TanStack table) ─────────────────────────── */
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        scope="col"
                        className="px-4 py-2 text-left text-xs font-medium text-slate-600 uppercase tracking-wider cursor-pointer"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() && (
                            <SortIcon
                              fontSize="inherit"
                              className={`transform transition-transform ${header.column.getIsSorted() === "desc" ? "rotate-180" : ""}`}
                            />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 text-sm">
                {table.getPaginationRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition duration-75">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2 whitespace-nowrap text-slate-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {mode === "full" && (
            <div className="flex justify-end items-center gap-3 p-3 border-t border-gray-200">
              <span className="text-sm text-slate-600">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
              <button
                className="px-3 py-1 text-sm font-medium rounded-lg text-slate-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </button>
              <button
                className="px-3 py-1 text-sm font-medium rounded-lg text-slate-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </button>
              <input
                type="number"
                placeholder={String(table.getState().pagination.pageIndex + 1)}
                className="w-24 border border-gray-300 rounded-lg p-1.5 text-sm text-center focus:border-slate-500"
                onChange={(e) => {
                  const page = e.target.value ? Number(e.target.value) - 1 : 0;
                  table.setPageIndex(page);
                }}
              />
            </div>
          )}
        </>
      )}

      {mode === "widget" && items.length > limit && (
        <div className="flex justify-end p-3 border-t border-gray-200">
          <button
            className="text-sm font-medium text-slate-700 hover:text-slate-900"
            onClick={() => window.location.assign("/inventory")}
          >
            View all
          </button>
        </div>
      )}

      {isError && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-300">
          Failed to load inventory
        </div>
      )}
    </div>
  );
}

InventoryTable.propTypes = {
  mode: PropTypes.oneOf(["full", "widget"]),
  limit: PropTypes.number,
  showColumns: PropTypes.arrayOf(PropTypes.string),
  lowStockThreshold: PropTypes.number,
  showFilterBar: PropTypes.bool,
  locationIds: PropTypes.arrayOf(PropTypes.number),
  onEditClick: PropTypes.func,
  onDeleteClick: PropTypes.func,
  onCategoriesLoaded: PropTypes.func,
};
