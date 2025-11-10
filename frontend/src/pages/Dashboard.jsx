import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";
import api from "../services/api";

const COLORS = [
    "#9AD0EC",
    "#FFB5E8",
    "#B5F2EA",
    "#F7D6E0",
    "#C8C6FA",
    "#FCE1A8",
    "#B7E4C7",
    "#F4A9A8",
    "#D4C5E2",
];

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: {
      display: true,
      text: "Inventory Quantities",
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
    x: {
      ticks: { font: { size: 12 }, color: "#4B5563" },
      grid: { display: false },
    },
    y: {
      ticks: { font: { size: 12 }, color: "#4B5563" },
      grid: { color: "rgba(200, 200, 200, 0.2)" },
    },
  },
};

const Dashboard = () => {
  const [chartData, setChartData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    const fetchInventoryData = async () => {
      try {
        const response = await api.get("/inventory/all");
        const inventory = response.data;
        setInventoryData(inventory);

        const uniqueCategories = [...new Set(inventory.map((item) => item.category))];
        setCategories(uniqueCategories);

        updateChartData(inventory);
      } catch (error) {
        console.error("Error fetching inventory data:", error);
      }
    };

    fetchInventoryData();
  }, []);

  const updateChartData = (inventory, category = "") => {
    const filtered = category
      ? inventory.filter((item) => item.category === category)
      : inventory;

    const labels = filtered.map((item) => item.name);
    const quantities = filtered.map((item) => item.quantity);

    setChartData({
      labels,
      datasets: [
        {
          label: "Quantity",
          data: quantities,
          backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length]),
          borderRadius: 6,
          borderWidth: 1,
        },
      ],
    });
  };

  const handleCategoryChange = (e) => {
    const category = e.target.value;
    setSelectedCategory(category);
    updateChartData(inventoryData, category);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "20px" }}>Inventory Dashboard</h1>

      <div style={{ marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center" }}>
        <label>Category:</label>
        <select
          value={selectedCategory}
          onChange={handleCategoryChange}
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

      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
          height: "450px",
        }}
      >
        {chartData ? <Bar data={chartData} options={chartOptions} /> : <p>Loading chart...</p>}
      </div>
    </div>
  );
};

export default Dashboard;
