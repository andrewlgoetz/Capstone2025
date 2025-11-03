import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
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
  TextField,            // NEW
  FormControl,          // NEW
  InputLabel,           // NEW
  Select,               // NEW
  MenuItem,             // NEW
  FormControlLabel,     // NEW
  Checkbox,             // NEW
} from '@mui/material'
import api from '../services/api'

// Default columns mapping to backend `inventory` table
const DEFAULT_COLUMNS = [
  { accessorKey: 'item_id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'category', header: 'Category' },
  { accessorKey: 'barcode', header: 'Barcode' },
  { accessorKey: 'quantity', header: 'Qty' },
  { accessorKey: 'unit', header: 'Unit' },
  { accessorKey: 'expiration_date', header: 'Expires' },
  { accessorKey: 'location_id', header: 'Location' },
  { accessorKey: 'date_added', header: 'Added' },
  { accessorKey: 'last_modified', header: 'Modified' },
]

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
  mode = 'full',
  items: externalItems = null,
  limit = 5,
  showColumns = null,
  onRowClick = null,
  lowStockThreshold = 10,                   // NEW (configurable)
  showFilterBar = true,                     // NEW (toggle toolbar)
}) {
  const [sorting, setSorting] = useState([])

   // --- Filter state (client-side) ----------------------------------------- NEW
   const [search, setSearch] = useState('')
   const [categoryFilter, setCategoryFilter] = useState('')
   const [lowStockOnly, setLowStockOnly] = useState(false)

   // NEW: expiry filters
    const [expiryFrom, setExpiryFrom] = useState('');     // "YYYY-MM-DD"
    const [expiryTo, setExpiryTo] = useState('');         // "YYYY-MM-DD"
    const [onlyWithExpiry, setOnlyWithExpiry] = useState(false);
    const [expiringInDays, setExpiringInDays] = useState(''); // e.g. "30" or ""

  // Decide which columns to render depending on mode & showColumns override
  const effectiveColumns = useMemo(() => {
    let cols = DEFAULT_COLUMNS
    if (mode === 'widget') {
      cols = DEFAULT_COLUMNS.filter((c) => ['name', 'quantity', 'unit', 'item_id'].includes(c.accessorKey))
    }
    if (Array.isArray(showColumns) && showColumns.length > 0) {
      cols = cols.filter((c) => showColumns.includes(c.accessorKey))
    }
    return cols.map((c) => ({
      accessorKey: c.accessorKey,
      header: c.header,
      cell: (info) => info.getValue(),
    }))
  }, [mode, showColumns])

  // Data source: prefer externalItems prop, otherwise fetch
  const query = useQuery({
    queryKey: ['inventory', { mode }],
    queryFn: async () => {
      const res = await api.get('/inventory')
      return res.data
    },
    enabled: externalItems == null,
  })

  const items = externalItems ?? query.data ?? []
  const isLoading = externalItems == null ? query.isLoading : false
  const isError = externalItems == null ? query.isError : false

  // If widget mode, limit rows shown (but react-table still has full data available)
  const displayed = mode === 'widget' ? items.slice(0, limit) : items

  // Build category list from current items (for dropdown) ------------------- NEW
  const categories = useMemo(() => {
    return Array.from(new Set(items.map((r) => r.category).filter(Boolean))).sort()
  }, [items])

  // NEW: date helpers
const parseYMD = (s) => (s ? new Date(`${s}T00:00:00`) : null); // avoid TZ shifts
const inNextNDays = (dateStr, n) => {
  if (!dateStr || !n) return false;
  const d = new Date(`${dateStr}T00:00:00`);
  const today = new Date(); today.setHours(0,0,0,0);
  const limit = new Date(today); limit.setDate(limit.getDate() + Number(n));
  return d >= today && d <= limit;
};

const filtered = useMemo(() => {
  const q = search.trim().toLowerCase();
  const from = parseYMD(expiryFrom);
  const to   = parseYMD(expiryTo);

  return displayed.filter((r) => {
    const matchesText =
      !q ||
      [r.name, r.category, r.barcode, r.location_id]
        .map((v) => String(v ?? '').toLowerCase())
        .some((txt) => txt.includes(q));

    const matchesCategory   = !categoryFilter || r.category === categoryFilter;
    const matchesLowStock   = !lowStockOnly || (Number(r.quantity ?? 0) <= lowStockThreshold);

    // --- NEW: expiry rules
    const hasExpiry = !!r.expiration_date;
    if (onlyWithExpiry && !hasExpiry) return false;

    let matchesDateRange = true;
    if (from && hasExpiry) matchesDateRange = matchesDateRange && new Date(`${r.expiration_date}T00:00:00`) >= from;
    if (to   && hasExpiry) matchesDateRange = matchesDateRange && new Date(`${r.expiration_date}T00:00:00`) <= to;
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
  displayed, search, categoryFilter, lowStockOnly, lowStockThreshold,
  expiryFrom, expiryTo, onlyWithExpiry, expiringInDays
]);

  const table = useReactTable({
    data: filtered,
    columns: effectiveColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Optional: default renderer in case a column omits `cell`
    defaultColumn: { cell: (info) => String(info.getValue() ?? '—') },
  })

  return (
    <Paper style={{ padding: 8 }}>
      {isLoading && <LinearProgress />}
      {/* Tiny filter bar ---------------------------------------------------- NEW */}
      {showFilterBar && mode === 'full' && (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
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
                <MenuItem key={c} value={c}>{c}</MenuItem>
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

      <Box sx={{ overflowX: 'auto' }}>
        <MuiTable size={mode === 'widget' ? 'small' : 'medium'}>
          <TableHead>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableCell key={header.id}>
                    <Typography variant="caption">{flexRender(header.column.columnDef.header, header.getContext())}</Typography>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                hover
                onClick={() => onRowClick && onRowClick(row.original)}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
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

      {mode === 'widget' && items.length > limit && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', padding: 1 }}>
          <Button size="small" onClick={() => window.location.assign('/inventory')}>
            View all
          </Button>
        </Box>
      )}

      {isError && <Typography color="error">Failed to load inventory</Typography>}
    </Paper>
  )
}

InventoryTable.propTypes = {
  mode: PropTypes.oneOf(['full', 'widget']),
  items: PropTypes.array,
  limit: PropTypes.number,
  showColumns: PropTypes.arrayOf(PropTypes.string),
  onRowClick: PropTypes.func,
  lowStockThreshold: PropTypes.number,      // NEW
  showFilterBar: PropTypes.bool,            // NEW
}