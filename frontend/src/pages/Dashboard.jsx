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

const Dashboard = () => {
  const [inventoryData, setInventoryData] = useState([]);
  const dashboardRef = useRef(null);
  const { hasPermission, selectedLocationIds, setSelectedLocationIds } = useAuth();
  const canDownload = hasPermission('reports:download');

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
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight);
      pdf.save("dashboard-overview.pdf");
    } catch (error) {
      console.error("Failed to generate dashboard PDF:", error);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ── Header row: title + location filter + download ── */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
