import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import WarningIcon from '@mui/icons-material/Warning';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CloseIcon from '@mui/icons-material/Close';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import RedeemIcon from '@mui/icons-material/Redeem'; 

import ScanSheet from '../components/ScanSheet.jsx'; 
import InventoryTable from '../components/InventoryTable.jsx';
import { getItems } from '../services/api';
import DemandLineChart from '../components/dashboard_widgets/DemandLineChart.jsx';
import LowStockTrendChart from '../components/dashboard_widgets/StockTrend.jsx';

import { fetchProductByBarcode } from '../services/off'; 

// Stat Card Component (Total Items, Low Stock, Expiring Soon, This Month Distributed)
const StatCard = ({ icon: Icon, title, value, accentColor }) => (
  <div className="p-5 bg-white rounded-xl shadow-sm border border-gray-200">
    <div className="flex items-start justify-between">
      <div className="flex flex-col">
        <div className="text-sm font-medium text-slate-500">{title}</div>
        <div className="text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">{value}</div>
      </div>
      <div className={`w-10 h-10 rounded-full grid place-items-center ${accentColor} bg-opacity-10`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

const CategoryChart = ({ title, data = [] }) => {
    const categoryTotals = useMemo(() => {
        const totals = data.reduce((acc, item) => {
            const category = item.category || 'Other';
            acc[category] = (acc[category] || 0) + (item.quantity || 0);
            return acc;
        }, {});
        return Object.entries(totals).map(([category, quantity]) => ({
            category,
            quantity,
        }));
    }, [data]);

    const topCategories = useMemo(() => {
        return categoryTotals
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);
    }, [categoryTotals]);

    const maxQuantity = topCategories[0]?.quantity || 1;

    return (
        <div className="bg-white rounded-xl p-4 grid grid-rows-[auto_1fr] shadow-lg border border-gray-200 h-full">
            <div className="text-xl font-semibold text-slate-800 mb-4 tracking-tight">{title}</div>
            
            <div className="space-y-4">
                {topCategories.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">No inventory data available for categorization.</p>
                ) : (
                    topCategories.map((item) => {
                        const widthPercent = (item.quantity / maxQuantity) * 100;
                        return (
                            <div key={item.category} className="text-sm">
                                <div className="flex justify-between text-slate-700 mb-0.5">
                                    <span className="font-medium">{item.category}</span>
                                    <span className="font-semibold">{item.quantity.toLocaleString()}</span>
                                </div>
                                <div className="h-2.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                        className="h-2.5 bg-blue-600 rounded-full transition-all duration-500" 
                                        style={{ width: `${widthPercent}%` }} 
                                    />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

const Home = () => {
  const [query, setQuery] = useState('')
  const [showScan, setShowScan] = useState(false)
  const [showFabMenu, setShowFabMenu] = useState(false)
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' })
  const [productDialog, setProductDialog] = useState({ open: false, loading: false, product: null, error: null })

  const { data: inventoryItems = [], isLoading: isDataLoading, isError } = useQuery({
    queryKey: ["inventoryItems"],
    queryFn: getItems,
  });

  const LOW_STOCK_THRESHOLD = 10;
  
  // Total Items (Sum of all quantities)
  const totalItems = useMemo(() => 
    inventoryItems.reduce((sum, item) => sum + (item.quantity || 0), 0),
    [inventoryItems]
  );
  
  // Low Stock
  const lowStock = useMemo(() => 
    inventoryItems.filter((i) => (i.quantity || 0) <= LOW_STOCK_THRESHOLD),
    [inventoryItems]
  );
  
  // Expiring Soon (Count of items expiring in next 30 days)
  const expiringSoon = useMemo(() => 
    inventoryItems.filter((i) => {
      if (!i.expiration_date) return false;
      
      const expiry = new Date(i.expiration_date);
      const today = new Date();
      const limitDate = new Date(today);
      limitDate.setDate(limitDate.getDate() + 30);
      
      return !isNaN(expiry) && expiry >= today && expiry <= limitDate;
    }),
    [inventoryItems]
  );
  const distributedThisMonth = 420; // Hardcoded


  // Auto-close snackbar logic 
  useEffect(() => {
    if (snack.open) {
      const timer = setTimeout(() => {
        setSnack(s => ({ ...s, open: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [snack.open]);

  const handleScan = (code) => {
    setProductDialog({ open: true, loading: true, product: null, error: null })
    fetchProductByBarcode(code)
      .then((product) => {
        setProductDialog({ open: true, loading: false, product, error: null })
        setSnack({ open: true, message: `Scanned ${code} — ${product.product_name || 'Unknown'}` , severity: 'success' })
      })
      .catch((err) => {
        const msg = err?.code === 'NOT_FOUND' ? `No OpenFoodFacts product for ${code}` : 'Lookup failed'
        setProductDialog({ open: true, loading: false, product: null, error: msg })
        setSnack({ open: true, message: msg, severity: 'warning' })
      })
  }

  const getWidgetValue = (value) => isDataLoading ? '...' : value.toLocaleString();
  const getWidgetCount = (list) => isDataLoading ? '...' : list.length;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Home
            </h1>
            <div className="inline-flex gap-2 items-center rounded-full px-3 py-1 text-sm bg-gray-100 text-slate-600 font-medium border border-gray-200 hidden sm:flex">
              <LocationOnIcon className="w-4 h-4 text-slate-500" />
              <span>Main Warehouse</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        <main className="space-y-6">  
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                icon={Inventory2Icon}
                title="Total Items"
                value={getWidgetValue(totalItems)}
                accentColor="text-blue-600"
              />
              <StatCard
                icon={WarningIcon}
                title="Low Stock (≤ 10)"
                value={getWidgetCount(lowStock)}
                accentColor="text-red-600"
              />
              <StatCard
                icon={AccessTimeIcon}
                title="Expiring Soon (30 days)"
                value={getWidgetCount(expiringSoon)}
                accentColor="text-purple-600"
              />
              <StatCard
                icon={RedeemIcon}
                title="This Month Distributed"
                value={distributedThisMonth}
                accentColor="text-pink-400"
              />
            </div>
            
            {/* Category Chart and Inventory Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                  <CategoryChart
                      title="Category Distribution"
                      data={inventoryItems}
                  />
              </div>

              {/* Inventory Table */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h4 className="text-xl font-semibold text-slate-800 m-0 tracking-tight">
                      Recent Inventory Activity
                    </h4>
                    <div className="relative">
                    </div>
                  </div>
                  <InventoryTable mode="widget" limit={5} showFilterBar={false} />
                </div>
              </div>
            </div>

            {/* Forecasting & Trends */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 space-y-4">
              <h3 className="text-xl font-semibold text-slate-800 tracking-tight mb-4">
                Forecasting & Trends
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                
                {/* Low Stock Trend Chart (StockTrend.jsx) */}
                <div className="min-h-[450px]">
                    <LowStockTrendChart />
                </div>
                
                {/* Demand Forecast Chart (DemandLineChart.jsx) */}
                <div className="min-h-[450px]">
                    <DemandLineChart />
                </div>
              </div>
            </div>

          </main>
        </div>

      {/* FAB (Floating Action Button) */}
      <div className="fixed bottom-8 right-8 z-30">
        <div className="relative">

          {showFabMenu && (
            <div className="absolute right-0 bottom-16 grid gap-2 p-2 bg-white border border-gray-200 rounded-xl shadow-xl">
              <button 
                className="px-4 py-2 text-sm rounded hover:bg-gray-100 whitespace-nowrap text-right font-medium text-slate-700"
                onClick={() => { setShowScan(true); setShowFabMenu(false); }}
              >
                Scan Item (Add/Update)
              </button>
              <button 
                className="px-4 py-2 text-sm rounded hover:bg-gray-100 whitespace-nowrap text-right font-medium text-slate-700"
                onClick={() => { setShowFabMenu(false); /* Update inventory logic */ }}
              >
                Manual Entry
              </button>
              <button 
                className="px-4 py-2 text-sm rounded hover:bg-gray-100 whitespace-nowrap text-right font-medium text-slate-700"
                onClick={() => { setShowFabMenu(false); /* Edit logic */ }}
              >
                Edit Location
              </button>
            </div>
          )}
          
          {/* FAB Button */}
          <button
            className="w-16 h-16 rounded-full bg-slate-800 text-white grid place-items-center shadow-xl transition hover:bg-slate-700"
            onClick={() => setShowFabMenu(!showFabMenu)}
          >
            <AddIcon className="w-8 h-8" />
          </button>
        </div>
      </div>

      {/* Scan Sheet Modal */}
      {showScan && (
        <ScanSheet
          onClose={() => setShowScan(false)}
          onScan={handleScan}
        />
      )}

      {/* Product Dialog */}
      {productDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setProductDialog({ open: false, loading: false, product: null, error: null })}>
          <div className="w-full max-w-sm bg-white rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-slate-800">Product details</h3>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {productDialog.loading && (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm text-slate-600">Looking up product…</p>
                </div>
              )}
              {!productDialog.loading && productDialog.error && (
                <div className="p-3 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded">
                  {productDialog.error}
                </div>
              )}
              {!productDialog.loading && productDialog.product && (
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-slate-900">
                    {productDialog.product.product_name || 'Unknown product'}
                  </p>
                  {productDialog.product.brands && (
                    <p className="text-sm text-slate-500">Brand: {productDialog.product.brands}</p>
                  )}
                  {productDialog.product.image_front_small_url && (
                    <img src={productDialog.product.image_front_small_url} alt={productDialog.product.product_name} className="w-full rounded-md mt-1 shadow-md" />
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {productDialog.product.nutriscore_grade && (
                      <span className="text-xs px-2 py-0.5 border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-full">
                        Nutri-Score: {String(productDialog.product.nutriscore_grade).toUpperCase()}
                      </span>
                    )}
                    {productDialog.product.nova_group && (
                      <span className="text-xs px-2 py-0.5 border border-blue-300 bg-blue-50 text-blue-700 rounded-full">
                        NOVA group: {productDialog.product.nova_group}
                      </span>
                    )}
                  </div>
                  {productDialog.product.quantity && (
                    <p className="text-sm pt-1 text-slate-700">Quantity: {productDialog.product.quantity}</p>
                  )}
                  {productDialog.product.categories && (
                    <p className="text-sm text-slate-500">{productDialog.product.categories}</p>
                  )}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-gray-200 flex justify-end">
              <button 
                onClick={() => setProductDialog({ open: false, loading: false, product: null, error: null })}
                className="px-3 py-1 text-sm rounded bg-gray-100 text-slate-700 hover:bg-gray-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snackbar/Toast */}
      {snack.open && (
        <div 
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-300"
        >
          <div 
            className={`p-3 text-sm rounded-lg shadow-xl flex items-center justify-between gap-4 ${
              snack.severity === 'success' ? 'bg-emerald-600 text-white' : 
              snack.severity === 'warning' ? 'bg-amber-500 text-slate-900' : 'bg-slate-600 text-white'
            }`}
          >
            {snack.message}
            <button className="opacity-70 hover:opacity-100" onClick={() => setSnack(s => ({ ...s, open: false }))}>
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;