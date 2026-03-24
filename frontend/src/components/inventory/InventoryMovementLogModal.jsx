import { useMemo, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import { useQuery } from '@tanstack/react-query';
import { getInventoryMovements } from '../../services/api';

function formatTimestamp(value) {
  if (!value) return 'Unknown time';
  return new Date(value).toLocaleString();
}

const TYPE_STYLES = {
  INBOUND:    'bg-emerald-100 text-emerald-700',
  OUTBOUND:   'bg-amber-100 text-amber-700',
  TRANSFER:   'bg-blue-100 text-blue-700',
  WASTE:      'bg-red-100 text-red-700',
  ADJUSTMENT: 'bg-slate-100 text-slate-600',
};

function TypeBadge({ type }) {
  const style = TYPE_STYLES[(type || '').toUpperCase()] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${style}`}>
      {type || '—'}
    </span>
  );
}

function getFriendlyLocationLabel(movement) {
  if (movement.from_location_name && movement.to_location_name)
    return `${movement.from_location_name} → ${movement.to_location_name}`;
  if (movement.to_location_name) return movement.to_location_name;
  if (movement.from_location_name) return movement.from_location_name;
  return 'No location';
}

function matchesLocationFilter(movement, locationFilter) {
  if (locationFilter === 'ALL') return true;
  return (
    String(movement.from_location_id) === locationFilter ||
    String(movement.to_location_id) === locationFilter
  );
}

const selectClass = "px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-500 transition";

export default function InventoryMovementLogModal({ open, onClose, locationIds = [] }) {
  const [search, setSearch] = useState('');
  const [movementFilter, setMovementFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [userFilter, setUserFilter] = useState('ALL');
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
    movements.forEach((m) => {
      if (m.from_location_id && m.from_location_name) map.set(String(m.from_location_id), m.from_location_name);
      if (m.to_location_id && m.to_location_name) map.set(String(m.to_location_id), m.to_location_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [movements]);

  const userOptions = useMemo(() => {
    const map = new Map();
    movements.forEach((m) => map.set(String(m.user_id ?? 'system'), m.user_name || 'System'));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [movements]);

  const filteredMovements = useMemo(() => {
    const term = search.trim().toLowerCase();
    return movements.filter((m) => {
      const matchesSearch = !term || [
        m.item_name, m.item_category, m.item_barcode, m.reason, m.user_name, m.from_location_name, m.to_location_name, m.movement_type,
      ].filter(Boolean).some((v) => String(v).toLowerCase().includes(term));

      const matchesType = movementFilter === 'ALL' || m.movement_type === movementFilter;
      const matchesLocation = matchesLocationFilter(m, locationFilter);
      const matchesUser = userFilter === 'ALL' || String(m.user_id ?? 'system') === userFilter;

      return matchesSearch && matchesType && matchesLocation && matchesUser;
    });
  }, [movements, search, movementFilter, locationFilter, userFilter]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <HistoryIcon fontSize="small" className="text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-800">Item Movement Log</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 hover:text-slate-600 transition">
            <CloseIcon fontSize="small" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-100 shrink-0 space-y-3">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Search item, user, reason, barcode…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${selectClass} flex-1 min-w-48`}
            />
            <select value={movementFilter} onChange={(e) => setMovementFilter(e.target.value)} className={selectClass}>
              <option value="ALL">All movements</option>
              <option value="INBOUND">Inbound</option>
              <option value="OUTBOUND">Outbound</option>
              <option value="TRANSFER">Transfer</option>
              <option value="WASTE">Waste</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className={selectClass}>
              <option value="ALL">All locations</option>
              {locationOptions.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className={selectClass}>
              <option value="ALL">All users</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-700">{filteredMovements.length}</span> of {movements.length} movements
            </p>
            <div className="flex items-center gap-3">
              {/* Detailed view toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Detailed view</span>
                <button
                  type="button"
                  onClick={() => setShowDetailedView((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    showDetailedView ? 'bg-slate-800' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                    showDetailedView ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition"
              >
                {isFetching ? 'Refreshing…' : '↻ Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              Failed to load movement log.
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800" />
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-gray-200 rounded-xl">
              No movements match the current filters.
            </div>
          ) : showDetailedView ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Time', 'Type', 'Item', 'User', 'Raw Movement'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 align-top">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatTimestamp(m.timestamp)}</td>
                      <td className="px-4 py-3"><TypeBadge type={m.movement_type} /></td>
                      <td className="px-4 py-3 min-w-[180px]">
                        <p className="font-semibold text-slate-800">{m.item_name || `Item #${m.item_id}`}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Qty change: {m.quantity_change}</p>
                        <p className="text-xs text-slate-400">Location: {getFriendlyLocationLabel(m)}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 min-w-[120px]">{m.user_name || 'System'}</td>
                      <td className="px-4 py-3">
                        <pre className="m-0 p-3 text-xs leading-relaxed rounded-lg bg-slate-900 text-slate-200 overflow-x-auto max-w-[480px]">
                          {JSON.stringify({
                            ...m.raw,
                            item_name: m.item_name,
                            item_category: m.item_category,
                            item_unit: m.item_unit,
                            item_barcode: m.item_barcode,
                            current_quantity: m.current_quantity,
                            user_name: m.user_name,
                            from_location_name: m.from_location_name,
                            to_location_name: m.to_location_name,
                          }, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMovements.map((m) => (
                <div key={m.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 rounded-xl border border-gray-200 bg-white hover:bg-slate-50 transition">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-slate-800 text-sm">{m.item_name || `Item #${m.item_id}`}</span>
                      <TypeBadge type={m.movement_type} />
                    </div>
                    <p className="text-xs text-slate-500">
                      {getFriendlyLocationLabel(m)} · By {m.user_name || 'System'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Qty change: {m.quantity_change}{m.item_unit ? ` ${m.item_unit}` : ''}
                      {m.reason ? ` · ${m.reason}` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 whitespace-nowrap shrink-0">{formatTimestamp(m.timestamp)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end shrink-0">
          {/* <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition"
          >
            Close
          </button> */}
        </div>
      </div>
    </div>
  );
}
