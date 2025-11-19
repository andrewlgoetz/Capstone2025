import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import ConfirmInventoryModal from '../components/ScanSheet/ConfirmInventoryModal.jsx'
import ConfirmQuantityModal from '../components/ScanSheet/ConfirmQuantityModal.jsx'
import ConfirmIncreaseModal from '../components/ScanSheet/ConfirmIncreaseModal.jsx'
import { fetchInventoryByBarcode, scanOutInventory, increaseInventory } from '../services/api'

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
  const [scanMode, setScanMode] = useState('in') // 'in' or 'out'
  const [showFabMenu, setShowFabMenu] = useState(false)
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' })
  const [productDialog, setProductDialog] = useState({ open: false, loading: false, product: null, error: null })

  const { data: inventoryItems = [], isLoading: isDataLoading, isError } = useQuery({
    queryKey: ["inventoryItems"],
    queryFn: getItems,
  });

  const queryClient = useQueryClient();

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
  // start a loading lookup but don't open the generic product dialog yet
  // (we may show increase/quantity modals instead)
  setProductDialog({ open: false, loading: true, product: null, error: null })

    // run both lookups in parallel
    Promise.allSettled([fetchProductByBarcode(code), fetchInventoryByBarcode(code)])
      .then(([prodRes, invRes]) => {
        const product = prodRes.status === 'fulfilled' ? prodRes.value : null
        const inventory = invRes.status === 'fulfilled' ? invRes.value : { barcode: code }

        // If inventory is a known item (has item_id), show the increase modal instead of full-edit modal
        if (inventory && inventory.item_id) {
          // close the generic product dialog and open the scan-in increase modal
          setProductDialog({ open: false, loading: false, product: product, inventory: inventory, error: null })
          setScanInTarget({ product, inventory })
          setSnack({ open: true, message: `Scanned ${code}` , severity: 'success' })
        } else {
    setProductDialog({ open: true, loading: false, product: product, inventory: inventory, error: null })
          setSnack({ open: true, message: `Scanned ${code}` , severity: 'success' })
        }
      })
      .catch(() => {
  // show generic dialog on lookup failure
  setProductDialog({ open: true, loading: false, product: null, inventory: { barcode: code }, error: 'Lookup failed' })
        setSnack({ open: true, message: 'Lookup failed', severity: 'warning' })
      })
  }

  // Scan out flow: expects barcode exists; opens confirm quantity modal and calls dummy scanOutInventory
  const [scanOutTarget, setScanOutTarget] = useState(null)
  const [scanInTarget, setScanInTarget] = useState(null)

  const handleScanOut = (code) => {
  // fetch product image and inventory info similar to scan-in, then show quantity modal
  // don't open the generic dialog while loading; we'll show the quantity modal when ready
  setProductDialog({ open: false, loading: true, product: null, error: null })
    Promise.allSettled([fetchProductByBarcode(code), fetchInventoryByBarcode(code)])
      .then(([prodRes, invRes]) => {
        const product = prodRes.status === 'fulfilled' ? prodRes.value : null
        const inventory = invRes.status === 'fulfilled' ? invRes.value : { barcode: code }

        setProductDialog({ open: false, loading: false, product: product, inventory: inventory, error: null })
        // show separate modal for quantity confirmation
        setScanOutTarget({ product, inventory })
      })
      .catch(() => {
        setProductDialog({ open: false, loading: false, product: null, inventory: { barcode: code }, error: 'Lookup failed' })
        setSnack({ open: true, message: 'Lookup failed', severity: 'warning' })
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
                      {/* <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="text"
                        className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-full w-48 text-sm focus:ring-slate-500 focus:border-slate-500 transition"
                        placeholder="Quick filter..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      /> */}
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
                onClick={() => { setScanMode('in'); setShowScan(true); setShowFabMenu(false); }}
              >
                Scan In (Add/Update)
              </button>
              <button 
                className="px-4 py-2 text-sm rounded hover:bg-gray-100 whitespace-nowrap text-right font-medium text-slate-700"
                onClick={() => { setScanMode('out'); setShowScan(true); setShowFabMenu(false); }}
              >
                Scan Out
              </button>
              <button 
                className="px-4 py-2 text-sm rounded hover:bg-gray-100 whitespace-nowrap text-right font-medium text-slate-700"
                onClick={() => { setShowFabMenu(false); /* Edit logic */ }}
              >
               Bulk Import
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
          onScan={(code) => {
            setShowScan(false)
            if (scanMode === 'out') handleScanOut(code)
            else handleScan(code)
          }}
        />
      )}

      {/* Scan-Out Quantity Confirmation */}
      {scanOutTarget && (
        <ConfirmQuantityModal
          open={Boolean(scanOutTarget)}
          onClose={() => setScanOutTarget(null)}
          initial={{ barcode: scanOutTarget.inventory?.barcode, quantity: 1, name: scanOutTarget.inventory?.name }}
          imageUrl={scanOutTarget.product?.image_front_small_url}
          onConfirm={(payload) => {
            // call dummy API
            scanOutInventory(payload.barcode, payload.quantity)
              .then((res) => {
                console.log('Scan out result', res)
                setSnack({ open: true, message: `Scanned out ${payload.quantity} — remaining ${res.remaining_quantity}`, severity: 'success' })
                setScanOutTarget(null)
              })
              .catch(() => setSnack({ open: true, message: 'Scan out failed', severity: 'warning' }))
          }}
        />
      )}

      {/* Scan-In (existing item) Increase Confirmation */}
      {scanInTarget && (
        <ConfirmIncreaseModal
          open={Boolean(scanInTarget)}
          onClose={() => setScanInTarget(null)}
          initial={{ barcode: scanInTarget.inventory?.barcode, item_id: scanInTarget.inventory?.item_id, name: scanInTarget.inventory?.name, category: scanInTarget.inventory?.category }}
          imageUrl={scanInTarget.product?.image_front_small_url}
          onConfirm={(payload) => {
            increaseInventory(payload.item_id, payload.quantity)
              .then((res) => {
                setSnack({ open: true, message: `Added ${payload.quantity} — new qty ${res.quantity}`, severity: 'success' })
                setScanInTarget(null)
              })
              .catch(() => setSnack({ open: true, message: 'Increase failed', severity: 'warning' }))
          }}
        />
      )}

      {/* Product / Confirm Inventory Dialog (new) */}
      {productDialog.open && (
        <ConfirmInventoryModal
          open={productDialog.open}
          onClose={() => setProductDialog({ open: false, loading: false, product: null, inventory: null, error: null })}
          initial={productDialog.inventory || { barcode: productDialog.product?.code || '' }}
          imageUrl={productDialog.product?.image_front_small_url}
          onConfirm={(created) => {
            // created is the object returned from the backend createItem
            console.log('Confirmed inventory', created)
            setSnack({ open: true, message: `Created ${created.barcode || created.name} (qty ${created.quantity})`, severity: 'success' })
            // refresh inventory list
            try { queryClient.invalidateQueries(["inventoryItems"]) } catch { /* ignore if no client */ }
          }}
        />
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