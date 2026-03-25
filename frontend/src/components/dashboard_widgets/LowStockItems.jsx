import React, { useState, useMemo } from "react";
import { getItemEmoji } from "./emojiMap";
import WidgetInfo from "./WidgetInfo";

const LowStockItems = ({ inventory, defaultThreshold = 10 }) => {
  const [threshold, setThreshold] = useState(defaultThreshold);

  const maxQuantity = useMemo(
    () => Math.max(...inventory.map(i => i.quantity || 0), 20),
    [inventory]
  );

  const lowStockItems = useMemo(() => {
    return inventory
      .filter(item => typeof item.quantity === "number" && item.quantity <= threshold)
      .sort((a, b) => a.quantity - b.quantity);
  }, [inventory, threshold]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
           <h3 className="text-lg font-semibold text-slate-700">Low Stock</h3>
           <WidgetInfo text="Lists items whose current quantity is at or below the threshold. Drag the slider to adjust the threshold. Items are sorted from lowest to highest quantity so the most urgent ones appear first." />
           <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
             {lowStockItems.length}
           </span>
        </div>
        <div className="text-sm text-slate-500">
           Threshold: <span className="font-medium text-slate-800">{threshold}</span>
        </div>
      </div>

      <input
        type="range"
        min="1"
        max={maxQuantity}
        value={threshold}
        onChange={(e) => setThreshold(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer mb-6 accent-primary"
      />

      <div className="overflow-y-auto max-h-[300px] pr-2">
        {lowStockItems.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Stock levels look healthy.</p>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 rounded-l-md">Item</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right rounded-r-md">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lowStockItems.map((item) => (
                <tr key={item.item_id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">
                    <span className="mr-2">{getItemEmoji(item.name, item.category)}</span>
                    {item.name}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{item.category}</td>
                  <td className="px-3 py-2 text-right font-bold text-red-600">
                    {item.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LowStockItems;