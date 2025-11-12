import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Box,
} from '@mui/material'

const defaultItems = [
  { id: 'SKU-1201', name: 'Wireless barcode scanner', category: 'Hardware', stock: 24, reorderPoint: 15, status: 'Healthy' },
  { id: 'SKU-3380', name: 'Thermal shipping labels (500 pack)', category: 'Supplies', stock: 8, reorderPoint: 20, status: 'Restock soon' },
  { id: 'SKU-8845', name: 'Handheld POS terminal', category: 'Hardware', stock: 3, reorderPoint: 10, status: 'Critical' },
]

const getStatusColor = (status) => {
  switch (status) {
    case 'Healthy':
      return 'success'
    case 'Restock soon':
      return 'warning'
    case 'Critical':
      return 'error'
    default:
      return 'default'
  }
}

const InventoryTable = ({ title = 'Top products', caption = 'Snapshot of stock levels across key SKUs.', columns, items }) => {
  const rows = items ?? defaultItems

  const cols = columns ?? [
    { key: 'id', header: 'SKU' },
    { key: 'name', header: 'Product', render: (r) => <strong>{r.name}</strong> },
    { key: 'category', header: 'Category' },
    { key: 'stock', header: 'On hand' },
    { key: 'reorderPoint', header: 'Reorder point' },
    { key: 'status', header: 'Status', render: (r) => (
      <Chip label={r.status} color={getStatusColor(r.status)} variant="outlined" size="small" />
    ) },
  ]

  return (
    <Box>
      {title || caption ? (
        <Box sx={{ mb: 2 }}>
          {title && <h2 style={{ margin: '0 0 0.5rem 0' }}>{title}</h2>}
          {caption && <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>{caption}</p>}
        </Box>
      ) : null}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f3f4f6' }}>
              {cols.map((c) => (
                <TableCell key={c.key} sx={{ fontWeight: 600 }}>
                  {c.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                {cols.map((c) => (
                  <TableCell key={c.key}>
                    {c.render ? c.render(row) : row[c.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

export default InventoryTable
