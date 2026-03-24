import { useRef, useState } from 'react';
import DownloadIcon from '@mui/icons-material/Download';
import { downloadInventoryReport } from '../../services/api';

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function firstOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}

const REPORT_PRESETS = [
  { label: 'This Month', getRange: () => ({ start: firstOfMonth(), end: localToday() }) },
  { label: 'This Year',  getRange: () => ({ start: firstOfYear(),  end: localToday() }) },
  { label: 'Custom',     getRange: null },
];

export default function MovementReportButton({ locationIds = [] }) {
  const [showReport, setShowReport] = useState(false);
  const [reportPreset, setReportPreset] = useState(0);
  const [customStart, setCustomStart] = useState(firstOfMonth());
  const [customEnd, setCustomEnd] = useState(localToday());
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const ref = useRef(null);

  const handleDownload = async () => {
    setReportError('');
    const isCustom = REPORT_PRESETS[reportPreset].getRange === null;
    const start = isCustom ? customStart : REPORT_PRESETS[reportPreset].getRange().start;
    const end   = isCustom ? customEnd   : REPORT_PRESETS[reportPreset].getRange().end;
    if (!start || !end || start > end) { setReportError('Please select a valid date range.'); return; }
    setReportLoading(true);
    try {
      const blob = await downloadInventoryReport(locationIds, start, end);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-report-${start}-to-${end}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setShowReport(false);
    } catch {
      setReportError('Failed to generate report. Please try again.');
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setShowReport(v => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition"
      >
        <DownloadIcon fontSize="small" />
        Movement Report
      </button>
      {showReport && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">Movement Report</p>
          <p className="text-xs text-slate-400 mb-3">Inbound & outbound summary by item for the selected period.</p>
          <div className="flex rounded-lg overflow-hidden border border-slate-200 mb-4 text-sm">
            {REPORT_PRESETS.map((p, i) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setReportPreset(i)}
                className={`flex-1 py-1.5 font-medium transition ${
                  reportPreset === i ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {REPORT_PRESETS[reportPreset].getRange === null && (
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 w-10 shrink-0">From</label>
                <input type="date" value={customStart} max={customEnd} onChange={e => setCustomStart(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 w-10 shrink-0">To</label>
                <input type="date" value={customEnd} min={customStart} max={localToday()} onChange={e => setCustomEnd(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
            </div>
          )}
          {reportError && <p className="text-xs text-red-500 mb-2">{reportError}</p>}
          <button
            type="button"
            onClick={handleDownload}
            disabled={reportLoading}
            className="w-full py-2 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition disabled:opacity-60"
          >
            {reportLoading ? 'Generating…' : 'Download CSV'}
          </button>
        </div>
      )}
    </div>
  );
}
