import React from "react";
import { Pie } from "react-chartjs-2";
import "chart.js/auto";

const COLORS = [
  "#4f46e5", "#10b981", "#f59e0b", "#ef4444",
  "#3b82f6", "#8b5cf6", "#ec4899", "#64748b",
];

const InventoryCategoryPie = ({ inventory }) => {
  const counts = inventory.reduce((acc, item) => {
    if (item.category) {
      acc[item.category] = (acc[item.category] || 0) + 1;
    }
    return acc;
  }, {});

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const labels = sorted.map(([category]) => category);
  const values = sorted.map(([_, count]) => count);

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
    },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-[450px] flex flex-col">
      <h3 className="text-lg font-semibold text-slate-700 mb-6">Category Distribution</h3>
      <div className="relative flex-1">
        <Pie data={pieData} options={options} />
      </div>
    </div>
  );
};

export default InventoryCategoryPie;