import React, { useEffect, useRef, useState } from "react";
import api from "../services/api";
import InventoryQuantitiesBarChart from "../components/dashboard_widgets/InventoryQuantities";
import InventoryCategoryPie from "../components/dashboard_widgets/InventoryCategories";
import LowStockItems from "../components/dashboard_widgets/LowStockItems";
import ExpiringSoon from "../components/dashboard_widgets/ExpiringSoon";
import MovementSummary from "../components/dashboard_widgets/MovementSummary";
import LowStockTrend from "../components/dashboard_widgets/LowStockTrend";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useAuth } from "../contexts/AuthContext";
import LocationFilter from "../components/common/LocationFilter";
import DateRangeFilter from "../components/DateRangeFilter";
import { useDateRange } from "../hooks/useDateRange";
import DownloadIcon from '@mui/icons-material/Download';

const Dashboard = () => {
  const [inventoryData, setInventoryData] = useState([]);
  const dashboardRef = useRef(null);
  const { hasPermission, selectedLocationIds, setSelectedLocationIds, userLocations } = useAuth();
  const canDownload = hasPermission('reports:download');

  const totalItems = inventoryData.length;
  const totalQuantity = inventoryData.reduce((sum, item) => sum + item.quantity, 0);

  // --- Global date range (shared by all dashboard widgets) ---
  const dateRange = useDateRange('last30');
  const { startISO, endISO } = dateRange;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = selectedLocationIds?.length
          ? { location_ids: selectedLocationIds.join(',') }
          : {};
        // Pass date range so the backend can scope activity-based analytics
        params.start_date = startISO;
        params.end_date   = endISO;
        const res = await api.get("/inventory/allwithlocation", { params });
        setInventoryData(res.data);
      } catch (error) {
        console.error("Failed to fetch inventory:", error);
      }
    };
    fetchData();
  }, [selectedLocationIds, startISO, endISO]);

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

      pdf.setFillColor(79, 70, 229);
      pdf.rect(0, 0, pdfWidth, 40, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("Inventory Dashboard Report", pdfWidth / 2, 15, { align: "center" });

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

      const startY = currentY + 10;
      const availableHeight = pdfHeight - startY - 10;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let finalWidth = pdfWidth;
      let finalHeight = imgHeight;
      if (imgHeight > availableHeight) {
        finalHeight = availableHeight;
        finalWidth = (canvas.width * availableHeight) / canvas.height;
      }

      pdf.addImage(imgData, "PNG", (pdfWidth - finalWidth) / 2, startY, finalWidth, finalHeight);

      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Page 1 of 1 | Inventory Tracking System`, pdfWidth / 2, pdfHeight - 5, { align: "center" });

      const timestamp = new Date().toISOString().split('T')[0];
      pdf.save(`dashboard-report-${timestamp}.pdf`);
    } catch (error) {
      console.error("Failed to generate dashboard PDF:", error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-medium shadow-md hover:bg-slate-700 transition"
          >
            <DownloadIcon fontSize="small" />
            Save Dashboard as PDF
          </button>
        )}
      </div>

      {/* ── Global date range filter ── */}
      <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
        <DateRangeFilter
          preset={dateRange.preset}
          setPreset={dateRange.setPreset}
          customStart={dateRange.customStart}
          customEnd={dateRange.customEnd}
          setCustomRange={dateRange.setCustomRange}
        />
      </div>

      <div ref={dashboardRef}>
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

          {/* Trend charts — receive the full dateRange object */}
          <MovementSummary dateRange={dateRange} />
          <LowStockTrend dateRange={dateRange} defaultThreshold={10} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
