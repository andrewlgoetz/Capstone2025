import React, { useEffect, useState } from "react";
import api from "../services/api";
import InventoryQuantitiesBarChart from "../components/dashboard_widgets/InventoryQuantities";
import InventoryCategoryPie from "../components/dashboard_widgets/InventoryCategories";
import LowStockItems from "../components/dashboard_widgets/LowStockItems";
import ExpiringSoon from "../components/dashboard_widgets/ExpiringSoon";

const Dashboard = () => {
  const [inventoryData, setInventoryData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get("/inventory/all");
        setInventoryData(res.data);
      } catch (error) {
        console.error("Failed to fetch inventory:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overview of your inventory health and metrics.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Row: Charts */}
        <InventoryQuantitiesBarChart inventory={inventoryData} />
        <InventoryCategoryPie inventory={inventoryData} />

        {/* Bottom Row: Lists */}
        <LowStockItems inventory={inventoryData} />
        <ExpiringSoon data={inventoryData} days={30} />
      </div>
    </div>
  );
};

export default Dashboard;