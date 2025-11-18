import React, { useState, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";

const COLORS = [
  "#4f46e5", "#10b981", "#f59e0b", "#ef4444",
  "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6",
];

const InventoryQuantitiesBarChart = ({ inventory }) => {
  const [selectedCategory, setSelectedCategory] = useState("");

  const categories = useMemo(
    () => [...new Set(inventory.map((item) => item.category).filter(Boolean))],
    [inventory]
  );

  const filtered = selectedCategory
    ? inventory.filter((i) => i.category === selectedCategory)
    : inventory;

  const labels = filtered.map((i) => i.name);
  const values = filtered.map((i) => i.quantity);

  const data = {
    labels,
    datasets: [
      {
        label: "Stock Level",
        data: values,
        backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length]),
        borderRadius: 4,
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } },
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-[450px] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-700">Stock Levels</h3>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-600 focus:outline-none focus:border-primary"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="relative flex-1 w-full">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};

export default InventoryQuantitiesBarChart;