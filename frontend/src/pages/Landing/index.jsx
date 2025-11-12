import React, { useMemo, useState } from 'react'
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Fab,
  Menu,
  MenuItem,
  Paper,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import WarningIcon from '@mui/icons-material/Warning'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import StorageIcon from '@mui/icons-material/Storage'
import InventoryTable from '../../components/InventoryTable'
import ScanSheet from '../../components/ScanSheet'
import { fetchProductByBarcode } from '../../services/off'

const sampleItems = [
  { id: 'A-1001', name: 'Pasta (1 lb)', category: 'Dry Goods', qty: 46, unit: 'box', expires: '2026-02-01', location: 'Aisle 1', barcode: '076783001234' },
  { id: 'A-1002', name: 'Canned Beans', category: 'Canned', qty: 12, unit: 'can', expires: '2026-07-12', location: 'Aisle 3', barcode: '041497043210' },
  { id: 'A-1020', name: 'Diapers (M)', category: 'Care', qty: 5, unit: 'pack', expires: '2027-01-30', location: 'Aisle 7', barcode: '889123456789' },
  { id: 'A-1100', name: 'Milk (2%)', category: 'Perishables', qty: 18, unit: 'carton', expires: '2025-11-20', location: 'Cooler', barcode: '036000291452' },
]

const StatCard = ({ icon: Icon, title, value, badge }) => (
  <Card>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, bgcolor: 'primary.light', borderRadius: 1, color: 'primary.main' }}>
          <Icon />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography color="textSecondary" variant="body2">
            {title}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {value}
          </Typography>
        </Box>
        {badge && (
          <Chip
            label={badge}
            size="small"
            variant="outlined"
            sx={{ bgcolor: 'primary.light', color: 'primary.main', border: 'none' }}
          />
        )}
      </Box>
    </CardContent>
  </Card>
)

const PlaceholderChart = ({ title }) => (
  <Card>
    <CardContent>
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        {title}
      </Typography>
      <Box
        sx={{
          height: 150,
          bgcolor: 'rgba(0,0,0,0.05)',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'textSecondary',
          fontSize: '0.875rem',
        }}
      >
        Chart placeholder
      </Box>
    </CardContent>
  </Card>
)

const Landing = () => {
  const [query, setQuery] = useState('')
  const [filterLabel, setFilterLabel] = useState('none')
  const [showScan, setShowScan] = useState(false)
  const [lastScannedCode, setLastScannedCode] = useState(null)
  const [anchorEl, setAnchorEl] = useState(null)
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' })
  const [productDialog, setProductDialog] = useState({ open: false, loading: false, product: null, error: null })

  const handleScan = (code) => {
    setLastScannedCode(code)
    setQuery(code)
    setProductDialog({ open: true, loading: true, product: null, error: null })
    fetchProductByBarcode(code)
      .then((product) => {
        setProductDialog({ open: true, loading: false, product, error: null })
        setSnack({ open: true, message: `Scanned ${code} — ${product.product_name || 'Unknown'}` , severity: 'success' })
      })
      .catch((err) => {
        const msg = err?.code === 'NOT_FOUND' ? `No OpenFoodFacts product for ${code}` : 'Lookup failed'
        setProductDialog({ open: true, loading: false, product: null, error: msg })
        setSnack({ open: true, message: msg, severity: 'warning' })
      })
  }

  const lowStock = useMemo(() => sampleItems.filter((i) => i.qty <= 10), [])
  const expiringSoon = useMemo(() => sampleItems.filter((i) => i.category === 'Perishables'), [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let arr = sampleItems
    if (q) {
      arr = arr.filter((i) =>
        [i.name, i.category, i.location, i.barcode].some((v) => String(v).toLowerCase().includes(q))
      )
    }
    if (filterLabel !== 'none') {
      arr = arr.filter((i) => i.category === 'Perishables')
    }
    return arr
  }, [query, filterLabel])

  const columns = [
    { key: 'name', header: 'Item', render: (r) => <strong>{r.name}</strong> },
    { key: 'category', header: 'Category', render: (r) => (
      <Chip
        label={r.category}
        size="small"
        variant="outlined"
        color={r.category === 'Perishables' ? 'success' : 'default'}
      />
    ) },
    { key: 'qty', header: 'Qty' },
    { key: 'unit', header: 'Unit' },
    { key: 'expires', header: 'Expires' },
    { key: 'location', header: 'Location' },
    { key: 'barcode', header: 'Barcode', render: (r) => <Typography variant="body2" color="textSecondary">{r.barcode}</Typography> },
  ]

  const handleFabMenuOpen = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleFabMenuClose = () => {
    setAnchorEl(null)
  }

  const handleScanClick = () => {
    setShowScan(true)
    handleFabMenuClose()
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Hamilton Food Support
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Main Warehouse
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            icon={WarningIcon}
            title="Low Stock"
            value={lowStock.length}
            badge="Under 10"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            icon={AccessTimeIcon}
            title="Expiring Soon"
            value={expiringSoon.length}
            badge="Perishables"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            icon={StorageIcon}
            title="TBD"
            value="—"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardHeader
              title="Inventory"
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Search name, category, ..."
                    variant="outlined"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, color: 'textSecondary' }} />,
                    }}
                  />
                  <Button
                    size="small"
                    variant={filterLabel !== 'none' ? 'contained' : 'outlined'}
                    onClick={() => setFilterLabel(filterLabel === 'none' ? 'demo' : 'none')}
                  >
                    Filter: {filterLabel}
                  </Button>
                </Box>
              }
            />
            <CardContent>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      {columns.map((c) => (
                        <TableCell key={c.key} sx={{ fontWeight: 600 }}>
                          {c.header}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((item) => (
                      <TableRow key={item.id} hover>
                        {columns.map((c) => (
                          <TableCell key={c.key}>
                            {c.render ? c.render(item) : item[c.key]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Showing 1–24 of 124
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined">Prev</Button>
                  <Button size="small" variant="contained">1</Button>
                  <Button size="small" variant="outlined">2</Button>
                  <Button size="small" variant="outlined">3</Button>
                  <Button size="small" variant="outlined">Next</Button>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card>
            <CardHeader
              title="Forecast Preview"
              subheader="Upcoming 30 days"
            />
            <CardContent>
              <Stack spacing={2}>
                <PlaceholderChart title="Demand" />
                <PlaceholderChart title="Shortages" />
                <PlaceholderChart title="Top Categories" />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 4 }}>
        <CardHeader title="Dashboard Preview" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <PlaceholderChart title="By Category" />
            </Grid>
            <Grid item xs={12} md={4}>
              <PlaceholderChart title="Low Stock over time" />
            </Grid>
            <Grid item xs={12} md={4}>
              <PlaceholderChart title="Incoming vs. Outgoing" />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Box sx={{ position: 'fixed', bottom: 24, right: 24 }}>
        <Fab
          color="primary"
          aria-label="add"
          onClick={handleFabMenuOpen}
        >
          <AddIcon />
        </Fab>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleFabMenuClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <MenuItem onClick={handleScanClick}>Scan</MenuItem>
          <MenuItem onClick={handleFabMenuClose}>Update inventory</MenuItem>
          <MenuItem onClick={handleFabMenuClose}>...Edit</MenuItem>
        </Menu>
      </Box>

      {showScan && (
        <ScanSheet
          onClose={() => setShowScan(false)}
          onScan={handleScan}
        />
      )}

      <Dialog open={productDialog.open} onClose={() => setProductDialog({ open: false, loading: false, product: null, error: null })} maxWidth="xs" fullWidth>
        <DialogTitle>Product details</DialogTitle>
        <DialogContent dividers>
          {productDialog.loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2">Looking up product…</Typography>
            </Box>
          )}
          {!productDialog.loading && productDialog.error && (
            <Alert severity="warning">{productDialog.error}</Alert>
          )}
          {!productDialog.loading && productDialog.product && (
            <Stack spacing={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {productDialog.product.product_name || 'Unknown product'}
              </Typography>
              {productDialog.product.brands && (
                <Typography variant="body2" color="text.secondary">Brand: {productDialog.product.brands}</Typography>
              )}
              {productDialog.product.image_front_small_url && (
                <Box component="img" src={productDialog.product.image_front_small_url} alt={productDialog.product.product_name} sx={{ width: '100%', borderRadius: 1, mt: 1 }} />
              )}
              {productDialog.product.nutriscore_grade && (
                <Chip size="small" label={`Nutri-Score: ${String(productDialog.product.nutriscore_grade).toUpperCase()}`} color="success" variant="outlined" />
              )}
              {productDialog.product.nova_group && (
                <Chip size="small" label={`NOVA group: ${productDialog.product.nova_group}`} color="info" variant="outlined" />
              )}
              {productDialog.product.quantity && (
                <Typography variant="body2">Quantity: {productDialog.product.quantity}</Typography>
              )}
              {productDialog.product.categories && (
                <Typography variant="body2" color="text.secondary">{productDialog.product.categories}</Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProductDialog({ open: false, loading: false, product: null, error: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Container>
  )
}

export default Landing
