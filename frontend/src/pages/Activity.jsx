import React from 'react';
import { useQuery } from '@tanstack/react-query';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { getInventoryHistory } from '../services/api';

const Activity = () => {
  // Fetch up to 50 items for the dedicated history page
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["inventoryHistory", 50],
    queryFn: () => getInventoryHistory(50),
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Recent Activity
          </h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 mt-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading activity...</div>
          ) : activities.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No recent activity found.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {activities.map((item) => {
                const isPositive = item.quantity_change > 0;
                const date = new Date(item.timestamp);
                
                return (
                  <div key={item.id} className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                        isPositive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {isPositive ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
                      </div>
                      
                      <div className="flex flex-col">
                        <span className="text-lg font-semibold text-slate-900">{item.item_name}</span>
                        <span className="text-sm text-slate-500 capitalize mt-0.5">
                          {item.movement_type} • {item.location_name || 'No Location'} • By {item.user_name}
                        </span>
                        <span className="text-xs text-slate-400 mt-1">
                          {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end">
                      <span className={`text-2xl font-bold tracking-tight ${
                        isPositive ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {isPositive ? '+' : ''}{item.quantity_change}
                      </span>
                      {item.unit && <span className="text-xs text-slate-400 font-medium">{item.unit}</span>}
                      <span className="text-sm text-slate-500 font-medium mt-1">
                        Total: {item.current_quantity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Activity;