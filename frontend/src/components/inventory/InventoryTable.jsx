import { useMemo, useState } from "react";
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
import api, { getCategories } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import CategorySearch from "./CategorySearch";

const formatDate = (dateString) => {
  if (!dateString) return "—";
  return String(dateString).split("T")[0];
};

const EXPIRING_SOON_DAYS = 30;

const parseYMD = (s) => (s ? new Date(`${s}T00:00:00`) : null);

const inNextNDays = (dateStr, n) => {
  if (!dateStr || !n) return false;
  const d = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + Number(n));
  return d >= today && d <= limit;
};

const DEFAULT_COLUMNS = [
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
  lowStockThreshold = 10,
  locationIds = null,
  onEditClick = null,
  onDeleteClick = null,
}) {
  const [sorting, setSorting] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [expiryFrom, setExpiryFrom] = useState("");
  const [expiryTo, setExpiryTo] = useState("");
  const [expiryPreset, setExpiryPreset] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [groupView, setGroupView] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  const { hasPermission, userLocations } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["inventory", { locationIds }],
    queryFn: async () => {
      const params = locationIds?.length ? { location_ids: locationIds.join(',') } : {};
      const res = await api.get("/inventory/all", { params });
      return res.data;
    },
    enabled: hasPermission('inventory:view'),
  });

  const items = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.item_id - b.item_id),
    [data]
  );

  const serialMap = useMemo(() => {
    const map = {};
    items.forEach((item, i) => { map[item.item_id] = i + 1; });
    return map;
  }, [items]);

  const effectiveColumns = useMemo(() => {
    const serialCol = {
      id: "serial",
      header: "No.",
      enableSorting: false,
      cell: ({ row }) => serialMap[row.original.item_id] ?? "—",
    };

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

    const baseCols = [serialCol, ...DEFAULT_COLUMNS].map((c) => ({
      ...c,
      cell: c.cell || ((info) => info.getValue()),
    }));

    return (onEditClick || onDeleteClick) ? [...baseCols, actionsCol] : baseCols;
  }, [serialMap, onEditClick, onDeleteClick]);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const categories = useMemo(() => {
    return (categoriesQuery.data || [])
      .filter(cat => cat.is_active)
      .map(cat => cat.name);
  }, [categoriesQuery.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = parseYMD(expiryFrom);
    const to = parseYMD(expiryTo);

    return items.filter((r) => {
      const matchesText = !q || String(r.name ?? "").toLowerCase().includes(q);
      const matchesCategory = !categoryFilter || r.category === categoryFilter;
      const matchesLowStock = !lowStockOnly || Number(r.quantity ?? 0) <= lowStockThreshold;
      const hasExpiry = !!r.expiration_date;

      let matchesDateRange = true;
      if (from && hasExpiry) matchesDateRange = matchesDateRange && new Date(`${r.expiration_date}T00:00:00`) >= from;
      if (to && hasExpiry) matchesDateRange = matchesDateRange && new Date(`${r.expiration_date}T00:00:00`) <= to;
      if ((from || to) && !hasExpiry) matchesDateRange = false;

      const matchesPreset = !expiryPreset || inNextNDays(r.expiration_date, expiryPreset);

      return matchesText && matchesCategory && matchesLowStock && matchesDateRange && matchesPreset;
    });
  }, [items, search, categoryFilter, lowStockOnly, lowStockThreshold, expiryFrom, expiryTo, expiryPreset]);

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
    setExpandedCategories(allExpanded ? new Set() : new Set(groupedData.map((g) => g.category)));
  };

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

      {/* Filter bar */}
      <div className="border-b border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            className={`px-5 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${!groupView ? "border-slate-800 text-slate-800" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            onClick={() => setGroupView(false)}
          >
            Items
          </button>
          <button
            className={`px-5 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${groupView ? "border-slate-800 text-slate-800" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            onClick={() => setGroupView(true)}
          >
            By Category
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center px-3 py-2.5">
          <input
            type="text"
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-52 focus:outline-none focus:border-slate-500"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="w-56">
            <CategorySearch
              categories={categories}
              value={categoryFilter}
              onChange={(cat) => setCategoryFilter(cat)}
              placeholder="All categories…"
              inputClassName="py-1.5 px-3"
            />
          </div>
          <button
            onClick={() => setLowStockOnly((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${lowStockOnly ? "bg-amber-50 border-amber-400 text-amber-700" : "border-gray-300 text-slate-600 hover:bg-gray-50"}`}
          >
            Low stock (≤ {lowStockThreshold})
          </button>
          <button
            onClick={() => setShowMoreFilters((v) => !v)}
            className={`ml-auto px-3 py-1.5 rounded-lg text-sm font-medium border transition flex items-center gap-1 ${showMoreFilters || expiryFrom || expiryTo || expiryPreset ? "bg-slate-100 border-slate-400 text-slate-700" : "border-gray-300 text-slate-500 hover:bg-gray-50"}`}
          >
            Expiry filters
            <span className="text-xs">{showMoreFilters ? "▲" : "▼"}</span>
          </button>
        </div>

        {showMoreFilters && (
          <div className="flex flex-wrap gap-2 items-center px-3 pb-2.5">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
              <input
                type="date"
                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-slate-500"
                value={expiryFrom}
                onChange={(e) => { setExpiryFrom(e.target.value); setExpiryPreset(""); }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
              <input
                type="date"
                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-slate-500"
                value={expiryTo}
                onChange={(e) => { setExpiryTo(e.target.value); setExpiryPreset(""); }}
              />
            </div>
            <select
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-slate-600 focus:outline-none focus:border-slate-500"
              value={expiryPreset}
              onChange={(e) => { setExpiryPreset(e.target.value); setExpiryFrom(""); setExpiryTo(""); }}
            >
              <option value="">Expiring in...</option>
              <option value="7">Next 7 days</option>
              <option value="30">Next 30 days</option>
              <option value="60">Next 60 days</option>
              <option value="90">Next 90 days</option>
            </select>
            {(expiryFrom || expiryTo || expiryPreset) && (
              <button
                className="text-xs text-slate-400 hover:text-slate-600 underline"
                onClick={() => { setExpiryFrom(""); setExpiryTo(""); setExpiryPreset(""); }}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {(search || categoryFilter || lowStockOnly || expiryFrom || expiryTo || expiryPreset) && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-2">
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                Name: {search}
                <button onClick={() => setSearch("")} className="hover:text-slate-900">✕</button>
              </span>
            )}
            {categoryFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                Category: {categoryFilter}
                <button onClick={() => setCategoryFilter("")} className="hover:text-slate-900">✕</button>
              </span>
            )}
            {lowStockOnly && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                Low stock
                <button onClick={() => setLowStockOnly(false)} className="hover:text-amber-900">✕</button>
              </span>
            )}
            {expiryPreset && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                Expiring: next {expiryPreset} days
                <button onClick={() => setExpiryPreset("")} className="hover:text-slate-900">✕</button>
              </span>
            )}
            {(expiryFrom || expiryTo) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                Expiry: {expiryFrom || "…"} → {expiryTo || "…"}
                <button onClick={() => { setExpiryFrom(""); setExpiryTo(""); }} className="hover:text-slate-900">✕</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Grouped view */}
      {groupView ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
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
                    <tr
                      key={`group-${group.category}`}
                      className="bg-slate-50 hover:bg-slate-100 cursor-pointer select-none"
                      onClick={() => toggleCategory(group.category)}
                    >
                      <td className={`${tdClass} text-slate-400 text-xs`}>{isExpanded ? "▼" : "▶"}</td>
                      <td className={`${tdClass} font-semibold text-slate-800`}>{group.category}</td>
                      <td className={`${tdClass} text-center text-slate-600`}>{group.items.length}</td>
                      <td className={`${tdClass} text-center text-slate-600`}>{qtyDisplay}</td>
                      <td className={`${tdClass} text-center`}>
                        {group.lowStockCount > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{group.lowStockCount}</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className={`${tdClass} text-center`}>
                        {group.expiringSoonCount > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{group.expiringSoonCount}</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>

                    {isExpanded && group.items.map((item) => (
                        <tr key={`item-${item.item_id}`} className="hover:bg-gray-50 border-t border-gray-100">
                          <td className={tdClass} />
                          <td className={`${tdClass} pl-8 text-slate-500`}>
                            <span className="text-xs text-slate-400 mr-2">#{serialMap[item.item_id] ?? "—"}</span>
                            {item.name}
                          </td>
                          <td className={`${tdClass} text-center`}>
                            <span className="font-mono text-xs text-slate-400">{item.barcode ?? "—"}</span>
                          </td>
                          <td className={`${tdClass} text-center`}>{item.quantity} {item.unit}</td>
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
                    ))}
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
        /* Item view */
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
        </>
      )}

      {isError && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-300">
          Failed to load inventory
        </div>
      )}
    </div>
  );
}
