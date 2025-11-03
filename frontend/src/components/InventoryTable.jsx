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
}) {
  const [sorting, setSorting] = useState([])

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

  const table = useReactTable({
    data: displayed,
    columns: effectiveColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Paper style={{ padding: 8 }}>
      {isLoading && <LinearProgress />}

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
}