import React from "react";
import LowStockItems from "./dashboard_widgets/LowStockItems";
import ExpiringSoon from "./dashboard_widgets/ExpiringSoon";
import InventoryQuantitiesBarChart from "./dashboard_widgets/InventoryQuantities";
import InventoryCategoryPie from "./dashboard_widgets/InventoryCategories";
import LowStockTrend from "./dashboard_widgets/LowStockTrend";
import MovementSummary from "./dashboard_widgets/MovementSummary";

/**
 * Renders the correct dashboard widget for a given key.
 *
 * Props:
 *   widgetKey  – one of the keys from AVAILABLE_WIDGETS
 *   inventory  – raw inventory array already fetched on Home
 *   dateRange  – dateRange object from useDateRange (used by LowStockTrend)
 */
export default function WidgetRenderer({ widgetKey, inventory, dateRange }) {
  switch (widgetKey) {
    case "lowStockItems":
      return <LowStockItems inventory={inventory} />;

    case "expiringSoon":
      return <ExpiringSoon data={inventory} days={30} />;

    case "stockLevels":
      return <InventoryQuantitiesBarChart inventory={inventory} />;

    case "categoryDistribution":
      return <InventoryCategoryPie inventory={inventory} />;

    case "lowStockTrend":
      return <LowStockTrend dateRange={dateRange} defaultThreshold={10} />;

    case "movementSummary":
      return <MovementSummary dateRange={dateRange} />;

    default:
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-center text-sm text-slate-400">
          Unknown widget
        </div>
      );
  }
}
