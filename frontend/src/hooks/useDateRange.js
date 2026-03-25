import { useState, useMemo } from 'react';

/**
 * Preset identifiers for the date range selector.
 */
export const DATE_RANGE_PRESETS = [
  { key: 'last7',   label: 'Last 7 days',    days: 7 },
  { key: 'last30',  label: 'Last 30 days',   days: 30 },
  { key: 'last90',  label: 'Last 90 days',   days: 90 },
  { key: 'last12m', label: 'Last 12 months', days: 365 },
  { key: 'custom',  label: 'Custom range',   days: null },
];

/**
 * Returns a Date representing midnight (local) for `n` days ago.
 */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Hook: manages a dashboard-level date range.
 *
 * Returns:
 *   preset       – active preset key (string)
 *   setPreset    – select a named preset
 *   customStart  – custom start date string (YYYY-MM-DD) or ''
 *   customEnd    – custom end date string (YYYY-MM-DD) or ''
 *   setCustomRange – ({ start, end }) => void
 *   startDate    – resolved Date object (start of range)
 *   endDate      – resolved Date object (end of range, today for presets)
 *   startISO     – ISO string for startDate (useful as API query param)
 *   endISO       – ISO string for endDate (useful as API query param)
 */
export function useDateRange(defaultPreset = 'last30') {
  const [preset, setPresetKey] = useState(defaultPreset);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const setPreset = (key) => {
    setPresetKey(key);
    // Clear custom values when switching away from custom
    if (key !== 'custom') {
      setCustomStart('');
      setCustomEnd('');
    }
  };

  const setCustomRange = ({ start, end }) => {
    setPresetKey('custom');
    setCustomStart(start || '');
    setCustomEnd(end || '');
  };

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    if (preset === 'custom') {
      const s = customStart ? new Date(customStart + 'T00:00:00') : new Date(daysAgo(30));
      const e = customEnd   ? new Date(customEnd   + 'T23:59:59') : now;
      return { startDate: s, endDate: e };
    }

    const found = DATE_RANGE_PRESETS.find((p) => p.key === preset);
    const days = found?.days ?? 30;
    return { startDate: daysAgo(days), endDate: now };
  }, [preset, customStart, customEnd]);

  const startISO = startDate.toISOString().slice(0, 10);
  const endISO   = endDate.toISOString().slice(0, 10);

  return {
    preset,
    setPreset,
    customStart,
    customEnd,
    setCustomRange,
    startDate,
    endDate,
    startISO,
    endISO,
  };
}
