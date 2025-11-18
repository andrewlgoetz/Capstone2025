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
import {
  Box,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  LinearProgress,
  Typography,
  Paper,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  IconButton,
  Tooltip,
} from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete'; 
import api from "../services/api";

const formatDate = (info) => {
  const dateString = info.getValue();
  if (!dateString) return '—'; // Handle null or empty dates
  
  // Split the string at 'T' and return the first part (the date)
  return String(dateString).split('T')[0];
};

// Default columns mapping to backend `inventory` table
const DEFAULT_COLUMNS = [
  { accessorKey: "item_id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "category", header: "Category" },
  { accessorKey: "barcode", header: "Barcode" },
  { accessorKey: "quantity", header: "Qty" },
  { accessorKey: "unit", header: "Unit" },
  { accessorKey: "expiration_date", header: "Expires" },
  { accessorKey: "location_id", header: "Location" },
  { accessorKey: "date_added", header: "Date Added", cell: formatDate},
  { accessorKey: "last_modified", header: "Date Modified", cell: formatDate },
  // Actions column with Edit button
  // {
  //   id: "actions", 
  //   header: "Actions",
  //   enableSorting: false, // Actions columns are usually not sortable
  //   cell: (info) => (
  //     // The row data is available via info.row.original
  //     <EditButton item={info.row.original} />
  //   ),
  // },
];

/**
 * InventoryTable
 * Props:
 * - mode: 'full' | 'widget' (widget shows a compact subset)
 * - items: optional array of items (if provided, component will not fetch)
 * - limit: number of rows to show in widget mode
 * - showColumns: optional array of accessorKeys to display (defaults change by mode)
 * - onRowClick: optional callback when clicking a row
 */
export default function InventoryTable({
  mode = "full",
  limit = 25,
  showColumns = null,
  lowStockThreshold = 10,
  showFilterBar = true,
  onEditClick = null,
  onDeleteClick = null,
  onCategoriesLoaded = null,
}) {
  const [sorting, setSorting] = useState([]);

  // Filter controls
  const [search, setSearch] = useState(""); // search box
  const [categoryFilter, setCategoryFilter] = useState(""); // category dropdown
  const [lowStockOnly, setLowStockOnly] = useState(false); // low stock checkbox

  // Expiry filters
  const [expiryFrom, setExpiryFrom] = useState(""); // "YYYY-MM-DD"
  const [expiryTo, setExpiryTo] = useState(""); // "YYYY-MM-DD"
  const [onlyWithExpiry, setOnlyWithExpiry] = useState(false);
  const [expiringInDays, setExpiringInDays] = useState(""); // e.g. "30" or ""

  const [pagination, setPagination] = useState({
    pageIndex: 0, // Current page (starts at 0)
    pageSize: 10, // Number of rows per page (adjust this to fit the screen)
  });

  // Fetch data
  const query = useQuery({
    queryKey: ["inventory", { mode }],
    queryFn: async () => {
      const res = await api.get("/inventory/all");
      return res.data;
    },
  });

  // State mapping from query
  const items = query.data ?? [];
  const isLoading = query.isLoading;
  const isError = query.isError;

  const [serialMap, setSerialMap] = useState({});

  useEffect(() => {
    if (!items.length) {
      setSerialMap({});
      return;
    }

    // Recompute serials 1..N based on current items order
    const next = {};
    let serial = 1;
    const ordered = items;

    ordered.forEach((item) => {
      next[item.item_id] = serial++;
    });

    setSerialMap(next);
  }, [items]);

  // Decide which columns to render depending on mode (full table vs widget) & showColumns override
  const effectiveColumns = useMemo(() => {
    const serialCol = {
      id: "serial",
      header: "No.",
      enableSorting: false,
      cell: ({row}) => serialMap[row.original.item_id] ?? "—",
    };

    let cols = DEFAULT_COLUMNS.filter(c => c.accessorKey !== 'item_id');
    if (mode === "widget") {
      cols = cols.filter((c) =>
        ["name", "quantity", "unit"].includes(c.accessorKey)
        );
    }
    if (Array.isArray(showColumns) && showColumns.length > 0) {
      cols = cols.filter((c) => showColumns.includes(c.accessorKey));
    }
    const actionsCol = {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <>
          <Tooltip title="Edit item">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                if (onEditClick) onEditClick(row.original);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete item">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                if (onDeleteClick) onDeleteClick(row.original);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ),
    };
      
          const baseCols = [serialCol, ...cols].map((c) => ({
            ...c,
            cell: c.cell || ((info) => info.getValue()),
          }));
      
          return mode === "full" ? [...baseCols, actionsCol] : baseCols;
  }, [mode, showColumns, serialMap, onEditClick]);
  // If widget mode, limit rows shown
  const displayed = mode === "widget" ? items.slice(0, limit) : items;

  // ---------------------------Client-side Filtering -------------------------------------
  // Build category list from current items (for dropdown)
  const categories = useMemo(() => {
    return Array.from(
      new Set(items.map((r) => r.category).filter(Boolean))
    ).sort();
  }, [items]);

  useEffect(() => {
    if (onCategoriesLoaded) {
      onCategoriesLoaded(categories);
    }
  }, [categories]);  

  // Date helpers
  const parseYMD = (s) => (s ? new Date(`${s}T00:00:00`) : null); // avoid TZ shifts
  const inNextNDays = (dateStr, n) => {
    if (!dateStr || !n) return false;
    const d = new Date(`${dateStr}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + Number(n));
    return d >= today && d <= limit;
  };

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

      // --- NEW: expiry rules
      const hasExpiry = !!r.expiration_date;
      if (onlyWithExpiry && !hasExpiry) return false;

      let matchesDateRange = true;
      if (from && hasExpiry)
        matchesDateRange =
          matchesDateRange && new Date(`${r.expiration_date}T00:00:00`) >= from;
      if (to && hasExpiry)
        matchesDateRange =
          matchesDateRange && new Date(`${r.expiration_date}T00:00:00`) <= to;
      // If a range is set and item has no expiry, exclude it
      if ((from || to) && !hasExpiry) matchesDateRange = false;

      const matchesExpiringSoon =
        !expiringInDays || inNextNDays(r.expiration_date, expiringInDays);

      return (
        matchesText &&
        matchesCategory &&
        matchesLowStock &&
        matchesDateRange &&
        matchesExpiringSoon
      );
    });
  }, [
    displayed,
    search,
    categoryFilter,
    lowStockOnly,
    lowStockThreshold,
    expiryFrom,
    expiryTo,
    onlyWithExpiry,
    expiringInDays,
  ]);
  // --------------------------------------------------------------------------------------

  const table = useReactTable({
    data: filtered,
    columns: effectiveColumns,
    state: { sorting , pagination},
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // Optional: default renderer in case a column omits `cell`
    defaultColumn: { cell: (info) => String(info.getValue() ?? "—") },
  });

  return (
    <Paper style={{ padding: 8 }}>
      {isLoading && <LinearProgress />}
      {showFilterBar && mode === "full" && (
        <Box
          sx={{
            display: "flex",
            gap: 2,
            alignItems: "center",
            mb: 1,
            flexWrap: "wrap",
          }}
        >
          <TextField
            size="small"
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, category, barcode, location…"
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Category</InputLabel>
            <Select
              label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Checkbox
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
              />
            }
            label={`Low stock (≤ ${lowStockThreshold})`}
          />
          {/* NEW: Expiry From / To */}
          <TextField
            size="small"
            label="Expiry from"
            type="date"
            value={expiryFrom}
            onChange={(e) => setExpiryFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            label="Expiry to"
            type="date"
            value={expiryTo}
            onChange={(e) => setExpiryTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          {/* NEW: Only items with expiry */}
          <FormControlLabel
            control={
              <Checkbox
                checked={onlyWithExpiry}
                onChange={(e) => setOnlyWithExpiry(e.target.checked)}
              />
            }
            label="Only items with expiry"
          />

          {/* NEW (optional): Expiring within N days quick filter */}
          <TextField
            size="small"
            label="Expiring in (days)"
            type="number"
            inputProps={{ min: 1 }}
            value={expiringInDays}
            onChange={(e) => setExpiringInDays(e.target.value)}
            sx={{ width: 160 }}
          />
        </Box>
      )}
      {/* -------------------------------------------------------------------- NEW */}

      <Box sx={{ overflowX: "auto" }}>
        <MuiTable size={mode === "widget" ? "small" : "medium"}>
          <TableHead>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableCell key={header.id}>
                    <Typography variant="caption">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </Typography>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getPaginationRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                // hover
                // onClick={() => onRowClick && onRowClick(row.original)}
                // style={{ cursor: onRowClick ? "pointer" : "default" }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </MuiTable>
      </Box>
  
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2, padding: 1 }}>
        <Typography variant="body2">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </Typography>

        <Button
          size="small"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        
        <Button
          size="small"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
        
        {/* Optional: Jumper input */}
        <TextField
          size="small"
          type="number"
          label="Go to page"
          defaultValue={table.getState().pagination.pageIndex + 1}
          onChange={e => {
            const page = e.target.value ? Number(e.target.value) - 1 : 0;
            table.setPageIndex(page);
          }}
          sx={{ width: 100 }}
        />
      </Box>

      {mode === "widget" && items.length > limit && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", padding: 1 }}>
          <Button
            size="small"
            onClick={() => window.location.assign("/inventory")}
          >
            View all
          </Button>
        </Box>
      )}

      {isError && (
        <Typography color="error">Failed to load inventory</Typography>
      )}
    </Paper>
  );
}

InventoryTable.propTypes = {
  mode: PropTypes.oneOf(["full", "widget"]),
  limit: PropTypes.number,
  showColumns: PropTypes.arrayOf(PropTypes.string),
  // onRowClick: PropTypes.func,
  lowStockThreshold: PropTypes.number,
  showFilterBar: PropTypes.bool,
  onEditClick: PropTypes.func,
  onDeleteClick: PropTypes.func,
  onCategoriesLoaded: PropTypes.func,
};
