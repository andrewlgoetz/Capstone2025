import { useState } from "react";

export const AVAILABLE_WIDGETS = [
  {
    key: "lowStockItems",
    label: "Low Stock",
    description: "List of items currently below the stock threshold.",
  },
  {
    key: "expiringSoon",
    label: "Expiring Soon",
    description: "Items whose expiry date is approaching.",
  },
  {
    key: "stockLevels",
    label: "Stock Levels",
    description: "Bar chart of current quantity per item.",
  },
  {
    key: "categoryDistribution",
    label: "Category Distribution",
    description: "Pie chart of inventory split by category.",
  },
  {
    key: "lowStockTrend",
    label: "Low Stock Trend",
    description: "Line chart tracking low-stock count over time.",
  },
  {
    key: "movementSummary",
    label: "Movement Summary",
    description: "Grouped bar chart of inbound vs outbound units over time.",
  },
];

const STORAGE_KEY = "homeWidgetSlots";
const DEFAULT_SLOTS = ["lowStockItems", "expiringSoon"];

export function useHomeWidgets() {
  const [slots, setSlots] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 2) return parsed;
      }
    } catch {}
    return DEFAULT_SLOTS;
  });

  const updateSlots = (newSlots) => {
    setSlots(newSlots);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSlots));
  };

  return { slots, updateSlots };
}
