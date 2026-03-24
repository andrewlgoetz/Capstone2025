import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

// This component shows recent inventory activity, with a badge indicating quantity change and a link to the inventory page for more details. It fetches the 10 most recent movements and displays them in a scrollable list.

const RecentActivity = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await api.get("/inventory/history", { params: { limit: 10 } });
        setActivities(res.data);
      } catch (error) {
        console.error("Error fetching recent activity:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, []);

  const formatType = (type) => {
    if (!type) return "Movement";
    return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getBadgeStyle = (qty) => {
    if (qty > 0) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (qty < 0) return "text-rose-700 bg-rose-50 border-rose-200";
    return "text-slate-600 bg-slate-50 border-slate-200";
  };

  return (
    <div 
      onClick={() => navigate('/inventory')}
      className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-full cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 transition-colors">
            Recent Activity
          </h2>
          <p className="text-xs text-slate-500">Latest inventory movements</p>
        </div>
        
        <div className="text-sm font-semibold text-indigo-600 group-hover:translate-x-1 transition-all duration-300">
          View All &rarr;
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[250px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : activities.length === 0 ? (
        <div className="flex-1 flex items-center justify-center min-h-[250px]">
          <p className="text-slate-500 text-sm">No recent activity found.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[350px]">
          {activities.map((act) => (
            <div
              key={act.id}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1.5">
                  <div className={`w-2 h-2 rounded-full ${act.quantity_change > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                </div>
                
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800 text-sm">{act.item_name}</span>
                  <span className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <span className="font-medium text-slate-700">{formatType(act.movement_type)}</span>
                      • By {act.user_name}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">
                    {new Date(act.timestamp).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              <div className={`px-2.5 py-1 rounded-lg border text-sm font-bold shadow-sm ${getBadgeStyle(act.quantity_change)}`}>
                {act.quantity_change > 0 ? "+" : ""}
                {act.quantity_change} {act.unit || ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentActivity;