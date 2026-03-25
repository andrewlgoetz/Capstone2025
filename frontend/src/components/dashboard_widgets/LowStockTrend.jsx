import React, { useEffect, useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import api from "../../services/api";
import WidgetInfo from "./WidgetInfo";

const THRESHOLD_OPTIONS = [5, 10, 25];
const DEFAULT_THRESHOLD = 10;

/** Map the dateRange preset / span to a granularity string for the API. */
function resolveGranularity(dateRange) {
  const preset = dateRange?.preset;
  if (preset === "last7")   return "daily";
  if (preset === "last30")  return "weekly";
  if (preset === "last90")  return "weekly";
  if (preset === "last12m") return "monthly";

  // custom range
  const start = dateRange?.startDate;
  const end   = dateRange?.endDate;
  if (!start || !end) return "weekly";
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  if (days <= 31)  return "daily";
  if (days <= 120) return "weekly";
  return "monthly";
}

export default function LowStockTrend({ dateRange, defaultThreshold = DEFAULT_THRESHOLD }) {
  const [threshold, setThreshold] = useState(
    THRESHOLD_OPTIONS.includes(defaultThreshold) ? defaultThreshold : DEFAULT_THRESHOLD
  );
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [seriesData, setSeriesData] = useState(null); // { labels: [], values: [] }

  const startISO = dateRange?.startISO ?? null;
  const endISO   = dateRange?.endISO   ?? null;
  const granularity = resolveGranularity(dateRange);

  useEffect(() => {
    if (!startISO || !endISO) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    api.get("/inventory/low-stock-trend", {
      params: {
        start_date:  startISO,
        end_date:    endISO,
        threshold,
        granularity,
      },
    })
      .then((res) => {
        if (!cancelled) setSeriesData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail ?? "Failed to load trend data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [startISO, endISO, threshold, granularity]);

  const summary = useMemo(() => {
    const vals = seriesData?.values ?? [];
    if (!vals.length) return { current: 0, peak: 0, average: 0, allZero: true };
    const current = vals[vals.length - 1] ?? 0;
    const peak    = Math.max(...vals);
    const avg     = vals.reduce((s, n) => s + n, 0) / vals.length;
    return { current, peak, average: avg, allZero: vals.every((n) => n === 0) };
  }, [seriesData]);

  const chartData = {
    labels: seriesData?.labels ?? [],
    datasets: [{
      label: `Low-stock items (≤ ${threshold})`,
      data: seriesData?.values ?? [],
      borderColor: "#ef4444",
      backgroundColor: "rgba(239,68,68,0.10)",
      borderWidth: 2,
      tension: 0.35,
      pointRadius: 2,
      pointHoverRadius: 4,
      fill: false,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: "index", intersect: false },
    },
    interaction: { mode: "nearest", axis: "x", intersect: false },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0, font: { size: 11 } },
        grid: { color: "#f1f5f9" },
        title: { display: true, text: "Low-stock count" },
      },
    },
  };

  const isEmpty = !loading && !error && (!seriesData || seriesData.labels.length === 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-700">Low Stock Trend</h3>
            <WidgetInfo text="Tracks how many items were below the stock threshold at each point in time. Use the threshold dropdown to change what counts as 'low stock'. The global date range filter above controls the time window shown." />
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Items below threshold over time</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="low-stock-threshold" className="text-xs font-medium text-slate-500">
            Threshold
          </label>
          <select
            id="low-stock-threshold"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:border-primary"
          >
            {THRESHOLD_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
          Loading…
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center text-sm text-red-400">
          {error}
        </div>
      )}

      {isEmpty && !loading && !error && (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
          No low-stock trend data available for this period.
        </div>
      )}

      {!loading && !error && !isEmpty && (
        <>
          <div className="h-[300px]">
            <Line data={chartData} options={chartOptions} />
          </div>

          {summary.allZero && (
            <p className="mt-3 text-xs text-slate-400">
              No low-stock issues detected in this period.
            </p>
          )}

          {/* Summary row */}
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
              <p className="text-slate-500 text-xs">Current low-stock items</p>
              <p className="text-slate-800 font-semibold mt-0.5">{summary.current}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
              <p className="text-slate-500 text-xs">Peak in period</p>
              <p className="text-slate-800 font-semibold mt-0.5">{summary.peak}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
              <p className="text-slate-500 text-xs">Average in period</p>
              <p className="text-slate-800 font-semibold mt-0.5">{summary.average.toFixed(1)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

