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
  const { hasPermission, selectedLocationIds, setSelectedLocationIds, userLocations } = useAuth();
  const canDownload = hasPermission('reports:download');

  const totalItems = inventoryData.length;
  const totalQuantity = inventoryData.reduce((sum, item) => sum + item.quantity, 0);

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
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Header Section
      pdf.setFillColor(79, 70, 229);
      pdf.rect(0, 0, pdfWidth, 40, "F");

      // Title
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("Inventory Dashboard Report", pdfWidth / 2, 15, { align: "center" });

      // Date and Time
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      const reportDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      pdf.text(`Generated: ${reportDate}`, pdfWidth / 2, 25, { align: "center" });

      // Location info 
      let currentY = 32;
      if (selectedLocationIds?.length > 0) {
        const locationNames = userLocations
          .filter(loc => selectedLocationIds.includes(loc.location_id))
          .map(loc => loc.name)
          .join(", ");
        pdf.setFontSize(9);
        pdf.text(`Location(s): ${locationNames}`, pdfWidth / 2, currentY, { align: "center" });
        currentY += 6;
      }
      // Calculate image dimensions to fit on page
      const startY = currentY + 10; // Start after header
      const availableHeight = pdfHeight - startY - 10; 
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      // Scale image to fit if needed
      let finalWidth = pdfWidth;
      let finalHeight = imgHeight;
      if (imgHeight > availableHeight) {
        finalHeight = availableHeight;
        finalWidth = (canvas.width * availableHeight) / canvas.height;
      }

      // Add dashboard image
      pdf.addImage(imgData, "PNG", (pdfWidth - finalWidth) / 2, startY, finalWidth, finalHeight);

      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Page 1 of 1 | Inventory Tracking System`,
        pdfWidth / 2,
        pdfHeight - 5,
        { align: "center" }
      );

      const timestamp = new Date().toISOString().split('T')[0]; // Save with timestamp
      pdf.save(`dashboard-report-${timestamp}.pdf`);
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
        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Items</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{totalItems}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📦</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Units</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{totalQuantity.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
            </div>
          </div>
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
    </div>
  );
};

export default Dashboard;
