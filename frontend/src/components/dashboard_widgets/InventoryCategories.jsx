import React, { useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";
import "chart.js/auto";
import api from "../../services/api";
import WidgetInfo from "./WidgetInfo";
import { useAuth } from "../../contexts/AuthContext";

const COLORS = [
  "#4f46e5", "#10b981", "#f59e0b", "#ef4444",
  "#3b82f6", "#8b5cf6", "#ec4899", "#64748b",
  "#06b6d4", "#f97316", "#84cc16", "#a78bfa",
  "#fb7185", "#34d399", "#fbbf24",
];

const InventoryCategoryPie = ({ inventory }) => {
  const { selectedLocationIds } = useAuth();
  const [groups, setGroups]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = {};
    if (selectedLocationIds?.length) params.location_ids = selectedLocationIds.join(",");

    api.get("/inventory/category-group-summary", { params })
      .then((res) => { if (!cancelled) setGroups(res.data); })
      .catch(() => { if (!cancelled) setError("Failed to load category data."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [selectedLocationIds]);

  const labels = groups.map((g) => g.group);
  const values = groups.map((g) => g.quantity);

  const pieData = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: COLORS,
        borderWidth: 0,
      },
    ],
  };

  const options = {
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "right", labels: { boxWidth: 12, font: { size: 11 } } },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = values.reduce((a, b) => a + b, 0);
            const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
            return ` ${ctx.parsed.toLocaleString()} units (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-[450px] flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <h3 className="text-lg font-semibold text-slate-700">Category Distribution</h3>
        <WidgetInfo text="Shows total units on hand grouped by broad category (e.g. Canned Soups, Fresh Produce). Hover a slice to see exact units and percentage. The Stock Levels chart above lets you drill into individual items within a category." />
      </div>
      {loading && (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Loading…</div>
      )}
      {error && (
        <div className="flex-1 flex items-center justify-center text-sm text-red-400">{error}</div>
      )}
      {!loading && !error && groups.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">No inventory data.</div>
      )}
      {!loading && !error && groups.length > 0 && (
        <div className="relative flex-1">
          <Pie data={pieData} options={options} />
        </div>
      )}
    </div>
  );
};

export default InventoryCategoryPie;
