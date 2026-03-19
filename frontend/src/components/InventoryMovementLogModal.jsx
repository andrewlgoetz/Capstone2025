import { useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import { useQuery } from '@tanstack/react-query';
import { getInventoryMovements } from '../services/api';

function formatTimestamp(value) {
  if (!value) return 'Unknown time';
  return new Date(value).toLocaleString();
}

function getMovementColor(type) {
  switch ((type || '').toUpperCase()) {
    case 'INBOUND':
      return 'success';
    case 'OUTBOUND':
      return 'warning';
    case 'TRANSFER':
      return 'info';
    case 'WASTE':
      return 'error';
    case 'ADJUSTMENT':
      return 'default';
    default:
      return 'default';
  }
}

function getFriendlyLocationLabel(movement) {
  if (movement.from_location_name && movement.to_location_name) {
    return `${movement.from_location_name} -> ${movement.to_location_name}`;
  }
  if (movement.to_location_name) {
    return movement.to_location_name;
  }
  if (movement.from_location_name) {
    return movement.from_location_name;
  }
  return 'No location';
}

function matchesLocationFilter(movement, locationFilter) {
  if (locationFilter === 'ALL') return true;

  return (
    String(movement.from_location_id) === locationFilter ||
    String(movement.to_location_id) === locationFilter
  );
}

export default function InventoryMovementLogModal({ open, onClose, locationIds = [] }) {
  const [search, setSearch] = useState('');
  const [movementFilter, setMovementFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [userFilter, setUserFilter] = useState(null);
  const [showDetailedView, setShowDetailedView] = useState(false);

  const {
    data: movements = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['inventoryMovements', locationIds],
    queryFn: () => getInventoryMovements(locationIds, 1000),
    enabled: open,
    staleTime: 1000 * 30,
  });

  const locationOptions = useMemo(() => {
    const map = new Map();
    movements.forEach((movement) => {
      if (movement.from_location_id && movement.from_location_name) {
        map.set(String(movement.from_location_id), movement.from_location_name);
      }
      if (movement.to_location_id && movement.to_location_name) {
        map.set(String(movement.to_location_id), movement.to_location_name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [movements]);

  const userOptions = useMemo(() => {
    const map = new Map();
    movements.forEach((movement) => {
      map.set(String(movement.user_id ?? 'system'), movement.user_name || 'System');
    });
    return [
      { id: 'ALL', name: 'All users' },
      ...Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
    ];
  }, [movements]);

  const filteredMovements = useMemo(() => {
    const term = search.trim().toLowerCase();

    return movements.filter((movement) => {
      const matchesSearch =
        !term ||
        [
          movement.item_name,
          movement.item_category,
          movement.item_barcode,
          movement.reason,
          movement.user_name,
          movement.from_location_name,
          movement.to_location_name,
          movement.movement_type,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      const matchesType =
        movementFilter === 'ALL' || movement.movement_type === movementFilter;

      const matchesLocation = matchesLocationFilter(movement, locationFilter);

      const movementUserId = String(movement.user_id ?? 'system');
      const matchesUser = !userFilter || userFilter.id === 'ALL' || movementUserId === userFilter.id;

      return matchesSearch && matchesType && matchesLocation && matchesUser;
    });
  }, [movements, search, movementFilter, locationFilter, userFilter]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon fontSize="small" />
          <span>Item Movement Log</span>
        </Box>
        <Button onClick={onClose} color="inherit" sx={{ minWidth: 'auto', px: 1 }}>
          <CloseIcon fontSize="small" />
        </Button>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Search"
              placeholder="Item, user, reason, barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fullWidth
            />

            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel id="movement-type-filter-label">Movement</InputLabel>
              <Select
                labelId="movement-type-filter-label"
                value={movementFilter}
                label="Movement"
                onChange={(e) => setMovementFilter(e.target.value)}
              >
                <MenuItem value="ALL">All movements</MenuItem>
                <MenuItem value="INBOUND">Inbound</MenuItem>
                <MenuItem value="OUTBOUND">Outbound</MenuItem>
                <MenuItem value="TRANSFER">Transfer</MenuItem>
                <MenuItem value="WASTE">Waste</MenuItem>
                <MenuItem value="ADJUSTMENT">Adjustment</MenuItem>
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel id="movement-location-filter-label">Location</InputLabel>
              <Select
                labelId="movement-location-filter-label"
                value={locationFilter}
                label="Location"
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <MenuItem value="ALL">All locations</MenuItem>
                {locationOptions.map((location) => (
                  <MenuItem key={location.id} value={location.id}>
                    {location.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Autocomplete
              options={userOptions}
              value={userFilter}
              onChange={(_, value) => setUserFilter(value)}
              getOptionLabel={(option) => option?.name || ''}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              sx={{ minWidth: 220 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="User"
                  placeholder="Search users..."
                />
              )}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredMovements.length} of {movements.length} movements
            </Typography>

            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Detailed view
              </Typography>
              <Switch
                checked={showDetailedView}
                onChange={(e) => setShowDetailedView(e.target.checked)}
              />
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition"
                aria-label="Refresh"
              >
                {isFetching ? 'Refreshing...' : '↻ Refresh'}
              </button>
            </Stack>
          </Stack>

          {error && (
            <Alert severity="error">
              Failed to load movement log.
            </Alert>
          )}

          {isLoading ? (
            <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : filteredMovements.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              No movements match the current filters.
            </Paper>
          ) : showDetailedView ? (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 560 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                    <TableCell><strong>Time</strong></TableCell>
                    <TableCell><strong>Type</strong></TableCell>
                    <TableCell><strong>Item</strong></TableCell>
                    <TableCell><strong>User</strong></TableCell>
                    <TableCell><strong>Raw Movement</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredMovements.map((movement) => (
                    <TableRow key={movement.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        {formatTimestamp(movement.timestamp)}
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <Chip
                          label={movement.movement_type}
                          size="small"
                          color={getMovementColor(movement.movement_type)}
                        />
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top', minWidth: 180 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {movement.item_name || `Item #${movement.item_id}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Qty change: {movement.quantity_change}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Location: {getFriendlyLocationLabel(movement)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top', minWidth: 140 }}>
                        {movement.user_name || 'System'}
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <Box
                          component="pre"
                          sx={{
                            m: 0,
                            p: 1.5,
                            fontSize: 12,
                            lineHeight: 1.5,
                            borderRadius: 1,
                            backgroundColor: '#0f172a',
                            color: '#e2e8f0',
                            overflowX: 'auto',
                            maxWidth: 520,
                          }}
                        >
                          {JSON.stringify(
                            {
                              ...movement.raw,
                              item_name: movement.item_name,
                              item_category: movement.item_category,
                              item_unit: movement.item_unit,
                              item_barcode: movement.item_barcode,
                              current_quantity: movement.current_quantity,
                              user_name: movement.user_name,
                              from_location_name: movement.from_location_name,
                              to_location_name: movement.to_location_name,
                            },
                            null,
                            2
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Stack spacing={1.5}>
              {filteredMovements.map((movement) => (
                <Paper key={movement.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {movement.item_name || `Item #${movement.item_id}`}
                        </Typography>
                        <Chip
                          label={movement.movement_type}
                          size="small"
                          color={getMovementColor(movement.movement_type)}
                        />
                      </Stack>

                      <Typography variant="body2" color="text.secondary">
                        {getFriendlyLocationLabel(movement)} | By {movement.user_name || 'System'}
                      </Typography>

                      <Typography variant="body2" color="text.secondary">
                        Qty change: {movement.quantity_change}
                        {movement.item_unit ? ` ${movement.item_unit}` : ''}
                        {movement.reason ? ` | ${movement.reason}` : ''}
                      </Typography>
                    </Box>

                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                      {formatTimestamp(movement.timestamp)}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
