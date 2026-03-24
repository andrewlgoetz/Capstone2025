import React, { useEffect, useRef, useState } from "react";
import DownloadIcon from '@mui/icons-material/Download';
import api from "../services/api";
import { downloadInventoryReport } from "../services/api";
import InventoryQuantitiesBarChart from "../components/dashboard_widgets/InventoryQuantities";
import InventoryCategoryPie from "../components/dashboard_widgets/InventoryCategories";
import LowStockItems from "../components/dashboard_widgets/LowStockItems";
import ExpiringSoon from "../components/dashboard_widgets/ExpiringSoon";
import DemandLineChart from "../components/dashboard_widgets/DemandLineChart";
import StockTrend from "../components/dashboard_widgets/StockTrend";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useAuth } from "../contexts/AuthContext";
import LocationFilter from "../components/common/LocationFilter";

// Returns today's date as YYYY-MM-DD 
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Returns first day of current month as YYYY-MM-DD
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Returns first day of current year as YYYY-MM-DD
function firstOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}

const REPORT_PRESETS = [
  { label: "This Month", getRange: () => ({ start: firstOfMonth(), end: localToday() }) },
  { label: "This Year",  getRange: () => ({ start: firstOfYear(),  end: localToday() }) },
  { label: "Custom Range", getRange: null },
];

const Dashboard = () => {
  const [inventoryData, setInventoryData] = useState([]);
  const dashboardRef = useRef(null);
  const { hasPermission, selectedLocationIds, setSelectedLocationIds, userLocations } = useAuth();
  const canDownload = hasPermission('reports:download');

  // Report state
  const [showReport, setShowReport] = useState(false);
  const [reportPreset, setReportPreset] = useState(0); // index into REPORT_PRESETS
  const [customStart, setCustomStart] = useState(firstOfMonth());
  const [customEnd, setCustomEnd] = useState(localToday());
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");

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

  const handleDownloadReport = async () => {
    setReportError("");
    const isCustom = REPORT_PRESETS[reportPreset].getRange === null;
    const start = isCustom ? customStart : REPORT_PRESETS[reportPreset].getRange().start;
    const end   = isCustom ? customEnd   : REPORT_PRESETS[reportPreset].getRange().end;

    if (!start || !end || start > end) {
      setReportError("Please select a valid date range.");
      return;
    }

    setReportLoading(true);
    try {
      const blob = await downloadInventoryReport(selectedLocationIds, start, end);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory-report-${start}-to-${end}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setShowReport(false);
    } catch (err) {
      setReportError("Failed to generate report. Please try again.");
    } finally {
      setReportLoading(false);
    }
  };

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
          <div className="flex items-center gap-3 flex-wrap">
            {/* CSV Report */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowReport(v => !v)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-slate-700 rounded-xl font-medium shadow-sm hover:bg-gray-50 transition"
              >
                <DownloadIcon fontSize="small" />
                Export Report
              </button>

              {showReport && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Generate CSV Report</p>

                  {/* Preset tabs */}
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 mb-4 text-sm">
                    {REPORT_PRESETS.map((p, i) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setReportPreset(i)}
                        className={`flex-1 py-1.5 font-medium transition ${
                          reportPreset === i
                            ? "bg-indigo-600 text-white"
                            : "bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom date inputs */}
                  {REPORT_PRESETS[reportPreset].getRange === null && (
                    <div className="flex flex-col gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 w-10 shrink-0">From</label>
                        <input
                          type="date"
                          value={customStart}
                          max={customEnd}
                          onChange={e => setCustomStart(e.target.value)}
                          className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 w-10 shrink-0">To</label>
                        <input
                          type="date"
                          value={customEnd}
                          min={customStart}
                          max={localToday()}
                          onChange={e => setCustomEnd(e.target.value)}
                          className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
                    </div>
                  )}

                  {reportError && (
                    <p className="text-xs text-red-500 mb-2">{reportError}</p>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadReport}
                    disabled={reportLoading}
                    className="w-full py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 transition disabled:opacity-60"
                  >
                    {reportLoading ? "Generating…" : "Download CSV"}
                  </button>
                </div>
              )}
            </div>

            {/* PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-medium shadow-md hover:bg-slate-700 transition"
            >
              Download PDF
            </button>
          </div>
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
