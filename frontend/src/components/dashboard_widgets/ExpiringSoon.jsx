import React, { useState, useMemo } from "react";
import { getItemEmoji } from "./emojiMap";
import ExpandableText from "../common/ExpandableText";

const ExpiringSoon = ({ data = [], days = 14, limit = 15 }) => {
  const [thresholdDays, setThresholdDays] = useState(days);
  const today = new Date();

  const expiring = useMemo(() => {
    return (data || [])
      .filter(item => item.expiration_date)
      .map(item => {
        const exp = new Date(item.expiration_date);
        const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
        return { ...item, diffDays };
      })
      .filter(item => item.diffDays >= 0 && item.diffDays <= thresholdDays)
      .sort((a, b) => a.diffDays - b.diffDays)
      .slice(0, limit);
  }, [data, thresholdDays]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
           <h3 className="text-lg font-semibold text-slate-700">Expiring Soon</h3>
           <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
             {expiring.length}
           </span>
        </div>
        <div className="text-sm text-slate-500">
           Within: <span className="font-medium text-slate-800">{thresholdDays} days</span>
        </div>
      </div>

      <input
        type="range"
        min="1"
        max="60"
        value={thresholdDays}
        onChange={(e) => setThresholdDays(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer mb-6 accent-amber-500"
      />

      <div className="overflow-y-auto max-h-[300px] pr-2">
        {expiring.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No items expiring soon.</p>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 rounded-l-md">Item</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2 text-right rounded-r-md">Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expiring.map((item) => (
                <tr key={item.item_id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                    <span className="mr-2">{getItemEmoji(item.name, item.category)}</span>
                    {item.name}
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-xs max-w-[120px] truncate">
                     <ExpandableText text={item.location_name || "—"} maxLength={20} />
                  </td>
                  <td className={`px-3 py-2 text-right font-bold ${item.diffDays <= 3 ? "text-red-600" : "text-amber-600"}`}>
                    {item.diffDays === 0 ? "Today" : `${item.diffDays}d`}
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

export default ExpiringSoon;