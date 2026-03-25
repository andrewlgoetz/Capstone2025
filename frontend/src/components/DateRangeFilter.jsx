import React from 'react';
import { DATE_RANGE_PRESETS } from '../hooks/useDateRange';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

/**
 * DateRangeFilter
 *
 * Props (all supplied by useDateRange):
 *   preset        – active preset key
 *   setPreset     – (key) => void
 *   customStart   – YYYY-MM-DD string
 *   customEnd     – YYYY-MM-DD string
 *   setCustomRange – ({ start, end }) => void
 */
export default function DateRangeFilter({
  preset,
  setPreset,
  customStart,
  customEnd,
  setCustomRange,
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-sm font-medium text-slate-500 shrink-0">
        <CalendarTodayIcon sx={{ fontSize: 16 }} />
        Period:
      </span>

      {/* Preset pills */}
      <div className="flex flex-wrap gap-1.5">
        {DATE_RANGE_PRESETS.filter((p) => p.key !== 'custom').map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className={[
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              preset === p.key
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-600',
            ].join(' ')}
          >
            {p.label}
          </button>
        ))}

        {/* Custom toggle pill */}
        <button
          type="button"
          onClick={() => setPreset('custom')}
          className={[
            'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
            preset === 'custom'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-600',
          ].join(' ')}
        >
          Custom
        </button>
      </div>

      {/* Custom date inputs — shown only when custom preset is active */}
      {preset === 'custom' && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={customStart}
            max={customEnd || today}
            onChange={(e) => setCustomRange({ start: e.target.value, end: customEnd })}
            className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
            aria-label="Start date"
          />
          <span className="text-xs text-slate-400">→</span>
          <input
            type="date"
            value={customEnd}
            min={customStart || undefined}
            max={today}
            onChange={(e) => setCustomRange({ start: customStart, end: e.target.value })}
            className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
            aria-label="End date"
          />
        </div>
      )}
    </div>
  );
}
