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
      const res = await api.get("/inventory/all");
      setInventoryData(res.data);
    };
    fetchData();
  }, []);

    return (
        <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
          <h1 style={{ marginBottom: "20px" }}>Inventory Dashboard</h1>
      
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(450px, 1fr))",
              gap: "24px", // <--- adds space between widgets
            }}
          >
            <InventoryQuantitiesBarChart inventory={inventoryData} />
            <InventoryCategoryPie inventory={inventoryData} />
            <LowStockItems inventory={inventoryData} />
            <ExpiringSoon data={inventoryData} days={14} />
            {/* more widgets will simply drop in */}
          </div>
        </div>
      );
};

export default Dashboard;
