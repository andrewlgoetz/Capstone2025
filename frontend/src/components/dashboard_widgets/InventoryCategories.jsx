import React, { useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";
import "chart.js/auto";
import { getCategories } from "../../services/api";

const COLORS = [
  "#4f46e5", "#10b981", "#f59e0b", "#ef4444",
  "#3b82f6", "#8b5cf6", "#ec4899", "#64748b",
];

const InventoryCategoryPie = ({ inventory }) => {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data.filter(cat => cat.is_active));
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    };
    fetchCategories();
  }, []);

  // Sum quantities per category using the lookup table
  const categoryCounts = categories.map(cat => {
    const items = inventory.filter(item => item.category === cat.name);
    const quantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const itemCount = items.length;
    return { name: cat.name, quantity, itemCount };
  });

  // Filter out empty categories and sort by quantity
  const sorted = categoryCounts
    .filter(({ quantity }) => quantity > 0)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const labels = sorted.map(({ name, itemCount }) => `${name} (${itemCount} ${itemCount === 1 ? 'item' : 'items'})`);
  const values = sorted.map(({ quantity }) => quantity);

  const pieData = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: COLORS,
        borderWidth: 0,
      },
    ],
  };

  const options = {
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "right", labels: { boxWidth: 12, font: { size: 11 } } },
      title: { display: false },
    },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-[450px] flex flex-col">
      <h3 className="text-lg font-semibold text-slate-700 mb-6">Category Distribution</h3>
      <div className="relative flex-1">
        <Pie data={pieData} options={options} />
      </div>
    </div>
  );
};

export default InventoryCategoryPie;