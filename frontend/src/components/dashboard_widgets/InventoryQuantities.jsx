import React from "react";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";

// Colorblind-safe palette (no black)
const COLORS = [
    "#4E79A7", // Muted Blue
    "#F28E2B", // Muted Orange
    "#59A14F", // Muted Green
    "#E15759", // Muted Red
    "#76B7B2", // Teal
    "#EDC949", // Goldenrod
    "#B07AA1", // Muted Purple
    "#9C755F", // Brown
    "#BAB0AC", // Gray
];

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: {
      display: true,
      font: { size: 20, weight: "bold" },
      padding: 20,
    },
    tooltip: {
      backgroundColor: "rgba(0,0,0,0.85)",
      padding: 12,
      cornerRadius: 6,
    },
  },
  scales: {
    x: { grid: { display: false } },
    y: { grid: { color: "rgba(200, 200, 200, 0.2)" } },
  },
};

const InventoryBarChart = ({
  title,
  data,
  categories,
  selectedCategory,
  onCategoryChange,
}) => {

  // Build dataset for bar chart
  const labels = data.map((item) => item.name);
  const values = data.map((item) => item.quantity);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Quantity",
        data: values,
        backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length]),
        borderRadius: 6,
        borderWidth: 1,
      },
    ],
  };

  return (
    <div style={{ marginBottom: "30px" }}>
      <div style={{ marginBottom: "12px", display: "flex", gap: "12px" }}>
        {categories?.length > 0 && (
          <>
            <label>Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
          height: "450px",
        }}
      >
        <Bar
          data={chartData}
          options={{
            ...chartOptions,
            plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: title } }
          }}
        />
      </div>
    </div>
  );
};

export default InventoryBarChart;
