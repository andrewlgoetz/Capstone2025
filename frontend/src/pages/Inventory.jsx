import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'
import InventoryTable from '../components/InventoryTable'

export default function Inventory() {
  const navigate = useNavigate()

  return (
    <Box sx={{ p: 5 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography variant="h4">Inventory</Typography>
        <Button variant="contained" onClick={() => { /* TODO: open add item modal */ }}>Add Item</Button>
      </header>

      <InventoryTable
        mode="full"
        onRowClick={(item) => navigate(`/inventory/${item.item_id}`)}
        lowStockThreshold={5}
        showFilterBar
      />
    </Box>
  )
}