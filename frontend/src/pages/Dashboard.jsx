import React, { useEffect, useRef, useState } from "react";
import api from "../services/api";
import InventoryQuantitiesBarChart from "../components/dashboard_widgets/InventoryQuantities";
import InventoryCategoryPie from "../components/dashboard_widgets/InventoryCategories";
import LowStockItems from "../components/dashboard_widgets/LowStockItems";
import ExpiringSoon from "../components/dashboard_widgets/ExpiringSoon";
import DemandLineChart from "../components/dashboard_widgets/DemandLineChart";
import StockTrend from "../components/dashboard_widgets/StockTrend";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useAuth } from "../contexts/AuthContext";
import LocationFilter from "../components/LocationFilter";

const Dashboard = () => {
  const [inventoryData, setInventoryData] = useState([]);
  const dashboardRef = useRef(null);
  const { hasPermission, userLocations } = useAuth();
  const canDownload = hasPermission('reports:download');

  const [selectedLocationIds, setSelectedLocationIds] = useState(
    () => userLocations.map((l) => l.location_id)
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = selectedLocationIds?.length
          ? { location_ids: selectedLocationIds.join(',') }
          : {};
        const res = await api.get("/inventory/allwithlocation", { params });
        setInventoryData(res.data);
      } catch (error) {
        console.error("Failed to fetch inventory:", error);
      }
    };
    fetchData();
  }, [selectedLocationIds]);

  const handleDownloadPdf = async () => {
    if (!dashboardRef.current) return;

    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight);
      pdf.save("dashboard-overview.pdf");
    } catch (error) {
      console.error("Failed to generate dashboard PDF:", error);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
            <p className="text-slate-500 mt-1">Overview of your inventory health and metrics.</p>
          </div>
          <LocationFilter selectedIds={selectedLocationIds} onChange={setSelectedLocationIds} />
        </div>
        {canDownload && (
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center justify-center rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          >
            Download PDF
          </button>
        )}
      </div>

      <div ref={dashboardRef}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Row: Charts */}
        <InventoryQuantitiesBarChart inventory={inventoryData} />
        <InventoryCategoryPie inventory={inventoryData} />

        {/* Bottom Row: Lists */}
        <LowStockItems inventory={inventoryData} />
        <ExpiringSoon data={inventoryData} days={30} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
