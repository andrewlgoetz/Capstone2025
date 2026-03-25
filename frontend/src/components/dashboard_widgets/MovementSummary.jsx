import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";
import api from "../../services/api";
import WidgetInfo from "./WidgetInfo";

function resolveGranularity(dateRange) {
  const preset = dateRange?.preset;
  if (preset === "last7")   return "daily";
  if (preset === "last30")  return "weekly";
  if (preset === "last90")  return "weekly";
  if (preset === "last12m") return "monthly";
  const start = dateRange?.startDate;
  const end   = dateRange?.endDate;
  if (!start || !end) return "weekly";
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  if (days <= 31)  return "daily";
  if (days <= 120) return "weekly";
  return "monthly";
}

export default function MovementSummary({ dateRange }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const startISO    = dateRange?.startISO ?? null;
  const endISO      = dateRange?.endISO   ?? null;
  const granularity = resolveGranularity(dateRange);

  useEffect(() => {
    if (!startISO || !endISO) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.get("/inventory/movement-summary", {
      params: { start_date: startISO, end_date: endISO, granularity },
    })
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.detail ?? "Failed to load."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [startISO, endISO, granularity]);

  const totalInbound  = data?.inbound?.reduce((a, b) => a + b, 0) ?? 0;
  const totalOutbound = data?.outbound?.reduce((a, b) => a + b, 0) ?? 0;

  const chartData = {
    labels: data?.labels ?? [],
    datasets: [
      {
        label: "Inbound",
        data: data?.inbound ?? [],
        backgroundColor: "rgba(16,185,129,0.75)",
        borderRadius: 4,
        borderWidth: 0,
      },
      {
        label: "Outbound",
        data: data?.outbound ?? [],
        backgroundColor: "rgba(239,68,68,0.75)",
        borderRadius: 4,
        borderWidth: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 11 } } },
      y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { color: "#f1f5f9" } },
    },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-700">Movement Summary</h3>
            <WidgetInfo text="Shows total units received (inbound) vs distributed/wasted (outbound) per period. Use the global date range filter to change the window. A larger inbound bar means stock is building up; a larger outbound bar means more is going out than coming in." />
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Inbound vs outbound units over time</p>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-[260px] mt-4">
        {loading && (
          <div className="h-full flex items-center justify-center text-sm text-slate-400">Loading…</div>
        )}
        {error && (
          <div className="h-full flex items-center justify-center text-sm text-red-500">{error}</div>
        )}
        {!loading && !error && data && (
          <Bar data={chartData} options={chartOptions} />
        )}
      </div>

      {/* Summary row */}
      {!loading && !error && data && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
          <div className="bg-emerald-50 rounded-lg px-4 py-2">
            <p className="text-xs text-emerald-600 font-medium">Total received</p>
            <p className="text-xl font-bold text-emerald-700">{totalInbound.toLocaleString()}</p>
          </div>
          <div className="bg-red-50 rounded-lg px-4 py-2">
            <p className="text-xs text-red-500 font-medium">Total distributed</p>
            <p className="text-xl font-bold text-red-600">{totalOutbound.toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
