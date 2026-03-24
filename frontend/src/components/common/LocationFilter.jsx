import { useState, useRef, useEffect } from 'react';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Multi-select location filter dropdown.
 * Shows user's assigned locations as checkboxes with an "All" toggle.
 *
 * Props:
 *   selectedIds: number[]          — currently selected location IDs
 *   onChange:    (ids: number[]) => void
 *   allLocations: [{location_id, name}] — optional override (admin pages)
 */
export default function LocationFilter({ selectedIds, onChange, allLocations }) {
  const { userLocations, isAdmin } = useAuth();
  const locations = allLocations || userLocations || [];
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allIds = locations.map((l) => l.location_id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));

  const handleToggleAll = () => {
    onChange(allSelected ? [] : [...allIds]);
  };

  const handleToggle = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  // Label text
  const label =
    locations.length === 0
      ? 'No locations'
      : allSelected || selectedIds.length === 0
      ? 'All Locations'
      : selectedIds.length === 1
      ? locations.find((l) => l.location_id === selectedIds[0])?.name || '1 location'
      : `${selectedIds.length} of ${locations.length} locations`;

  if (locations.length === 0) {
    return (
      <div className="inline-flex gap-2 items-center rounded-full px-3 py-1 text-sm bg-gray-100 text-slate-400 font-medium border border-gray-200">
        <LocationOnIcon className="w-4 h-4" />
        <span>No locations assigned</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex gap-2 items-center rounded-full px-3 py-1.5 text-sm bg-gray-100 text-slate-700 font-medium border border-gray-200 hover:bg-gray-200 transition"
      >
        <LocationOnIcon className="w-4 h-4 text-slate-500" />
        <span>{label}</span>
        <KeyboardArrowDownIcon className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-xl py-1">
          {/* All toggle */}
          <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleToggleAll}
              className="rounded border-gray-300 text-slate-800 focus:ring-slate-500"
            />
            <span className="text-sm font-semibold text-slate-700">All Locations</span>
          </label>

          {/* Individual locations */}
          <div className="max-h-60 overflow-y-auto">
            {locations.map((loc) => (
              <label
                key={loc.location_id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(loc.location_id)}
                  onChange={() => handleToggle(loc.location_id)}
                  className="rounded border-gray-300 text-slate-800 focus:ring-slate-500"
                />
                <span className="text-sm text-slate-600">{loc.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
