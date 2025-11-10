import React, { useEffect, useState } from "react";
import api from "../services/api";
import InventoryQuantitiesBarChart from "../components/dashboard_widgets/InventoryQuantities";

const Dashboard = () => {
  const [inventoryData, setInventoryData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const res = await api.get("/inventory/all");
      setInventoryData(res.data);
      setCategories([...new Set(res.data.map((i) => i.category))]);
    };
    fetchData();
  }, []);

  const filteredData = selectedCategory
    ? inventoryData.filter((i) => i.category === selectedCategory)
    : inventoryData;

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "20px" }}>Inventory Dashboard</h1>

      <InventoryQuantitiesBarChart
        title="Inventory Quantities"
        data={filteredData}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />
    </div>
  );
};

export default Dashboard;
