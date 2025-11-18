import React from "react";
import { Pie } from "react-chartjs-2";
import "chart.js/auto";

const COLORS = [
  "#4E79A7",
  "#F28E2B",
  "#59A14F",
  "#E15759",
  "#76B7B2",
  "#EDC949",
  "#B07AA1",
  "#9C755F",
  "#BAB0AC",
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
        backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length]),
        borderColor: "white",
        borderWidth: 1,
      },
    ],
  };

  return (
    <div
      style={{
        background: "white",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ position: "relative", height: "350px" }}>
        <Pie
          data={pieData}
          options={{
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "right" },
              title: {
                display: true,
                text: "Category Distribution",
                font: { size: 18, weight: "bold" },
                padding: 20,
              },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    const value = context.raw;
                    const dataset = context.dataset.data;
                    const total = dataset.reduce((sum, val) => sum + val, 0);
                    const percentage = ((value / total) * 100).toFixed(1);
                    return `${context.label}: ${value} items (${percentage}%)`;
                  },
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default InventoryCategoryPie;
