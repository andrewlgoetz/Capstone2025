import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";
import api from "../services/api";

const Dashboard = () => {
  const [chartData, setChartData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    const fetchInventoryData = async () => {
      try {
        const response = await api.get("/inventory/all");
        console.log("API response:", response.data);
        const inventory = response.data;

        // Extract unique categories
        const uniqueCategories = [
          ...new Set(inventory.map((item) => item.category)),
        ];
        setCategories(uniqueCategories);

        // Prepare data for the chart
        updateChartData(inventory);
      } catch (error) {
        console.error("Error fetching inventory data:", error);
      }
    };

    fetchInventoryData();
  }, []);

  const updateChartData = (inventory, category = "") => {
    const filteredInventory = category
      ? inventory.filter((item) => item.category === category)
      : inventory;

    const labels = filteredInventory.map((item) => item.name);
    const quantities = filteredInventory.map((item) => item.quantity);

    setChartData({
      labels,
      datasets: [
        {
          label: "Inventory Quantity",
          data: quantities,
          backgroundColor: "rgba(75, 192, 192, 0.6)",
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: 1,
        },
      ],
    });
  };

  const handleCategoryChange = async (event) => {
    const category = event.target.value;
    setSelectedCategory(category);

    try {
      const response = await api.get("/inventory/all");
      const inventory = response.data;
      updateChartData(inventory, category);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
    }
  };

  return (
    <div>
      <h1>Inventory Dashboard</h1>
      <div>
        <label htmlFor="category">Filter by Category: </label>
        <select
          id="category"
          value={selectedCategory}
          onChange={handleCategoryChange}
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
      {chartData ? (
        <Bar
          data={chartData}
          options={{
            responsive: true,
            plugins: {
              legend: {
                position: "top",
              },
              title: {
                display: true,
                text: "Inventory Quantities",
              },
            },
          }}
        />
      ) : (
        <p>Loading chart...</p>
      )}
    </div>
  );
};

export default Dashboard;