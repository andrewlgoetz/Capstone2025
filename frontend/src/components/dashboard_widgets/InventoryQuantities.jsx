import React, { useState, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";

const COLORS = [
  "#4E79A7", "#F28E2B", "#59A14F", "#E15759",
  "#76B7B2", "#EDC949", "#B07AA1", "#9C755F", "#BAB0AC",
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
        borderRadius: 6,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: "Stock Levels by Item",
        font: { size: 18, weight: "bold" },
        padding: 20,
      },
    },
  };

  return (
    <div
      style={{
        background: "white",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
        height: "450px",
      }}
    >
      <div style={{ marginBottom: "14px", display: "flex", gap: "12px" }}>
        <label>Category:</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        >
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div style={{ position: "relative", height: "350px" }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};

export default InventoryQuantitiesBarChart;
