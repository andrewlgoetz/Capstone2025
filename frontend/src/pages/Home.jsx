import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import WarningIcon from '@mui/icons-material/Warning';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CloseIcon from '@mui/icons-material/Close';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import RedeemIcon from '@mui/icons-material/Redeem'; 

import ScanSheet from '../components/ScanSheet.jsx';
import InventoryTable from '../components/InventoryTable.jsx';
import { getItems, getCategories } from '../services/api';
import DemandLineChart from '../components/dashboard_widgets/DemandLineChart.jsx';
import LowStockTrendChart from '../components/dashboard_widgets/StockTrend.jsx';

import { fetchProductByBarcode } from '../services/off';
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LocationFilter from '../components/LocationFilter'
import ConfirmInventoryModal from '../components/ScanSheet/ConfirmInventoryModal.jsx'
import ConfirmQuantityModal from '../components/ScanSheet/ConfirmQuantityModal.jsx'
import ConfirmIncreaseModal from '../components/ScanSheet/ConfirmIncreaseModal.jsx'
import BulkImportModal from '../components/BulkImportModal.jsx'
import { fetchInventoryByBarcode, scanOutInventory, scanOutInventoryByItemId, increaseInventory, getMonthlyDistributed } from '../services/api'

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
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const categoryData = await getCategories();
                setCategories(categoryData.filter(cat => cat.is_active));
            } catch (error) {
                console.error("Failed to fetch categories:", error);
                // Fallback to extracting from inventory
                const inventoryCategories = [...new Set(data.map((item) => item.category).filter(Boolean))];
                setCategories(inventoryCategories.map(name => ({ name })));
            }
        };
        fetchCategories();
    }, [data]);

    const categoryTotals = useMemo(() => {
        return categories.map(cat => {
            const items = data.filter(item => item.category === cat.name);
            const quantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const itemCount = items.length;
            return { category: cat.name, quantity, itemCount };
        }).filter(({ quantity }) => quantity > 0);
    }, [categories, data]);

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
                                    <div className="flex flex-col">
                                        <span className="font-medium">{item.category}</span>
                                        <span className="text-xs text-slate-500">{item.itemCount} {item.itemCount === 1 ? 'item' : 'items'}</span>
                                    </div>
                                    <span className="font-semibold">{item.quantity.toLocaleString()} units</span>
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
  const [showScan, setShowScan] = useState(false)
  const [scanMode, setScanMode] = useState('in') // 'in' or 'out'
  const [showFabMenu, setShowFabMenu] = useState(false)
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' })
  const [productDialog, setProductDialog] = useState({ open: false, loading: false, product: null, error: null })
  const [showBulkImport, setShowBulkImport] = useState(false)

  const { hasPermission, userLocations, selectedLocationIds, setSelectedLocationIds } = useAuth();
  const canViewInventory = hasPermission('inventory:view');
  const canScanIn = hasPermission('barcode:scan_in');
  const canScanOut = hasPermission('barcode:scan_out');
  const canCreate = hasPermission('inventory:create');
  const showFab = canScanIn || canScanOut || canCreate;
  const navigate = useNavigate();

  const { data: inventoryItems = [], isLoading: isDataLoading } = useQuery({
    queryKey: ["inventoryItems", selectedLocationIds],
    queryFn: () => getItems(selectedLocationIds),
    enabled: canViewInventory,
  });

  const queryClient = useQueryClient();

  const LOW_STOCK_THRESHOLD = 10;
  
  // Total Items (Sum of all quantities)
  const totalItems = useMemo(() => 
    inventoryItems.length
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

  const [distributedThisMonth, setDistributedThisMonth] = useState(0);
  const [loadingDistributed, setLoadingDistributed] = useState(true);
  
  const fetchMonthlyDistributed = async () => {
    try {
      const data = await getMonthlyDistributed(selectedLocationIds);
      setDistributedThisMonth(data.distributed ?? 0);
    } catch (error) {
      console.error('Failed to fetch monthly distributed:', error);
      setDistributedThisMonth(0);
    } finally {
      setLoadingDistributed(false);
    }
  };
  
  useEffect(() => {
    fetchMonthlyDistributed();
  }, [selectedLocationIds]);

  // Auto-close snackbar logic 
  useEffect(() => {
    if (snack.open) {
      const timer = setTimeout(() => {
        setSnack(s => ({ ...s, open: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [snack.open]);

  const handleScan = (code, locationId) => {
    setProductDialog({ open: false, loading: true, product: null, error: null })

    Promise.allSettled([fetchProductByBarcode(code), fetchInventoryByBarcode(code)])
      .then(([prodRes, invRes]) => {
        const product = prodRes.status === 'fulfilled' ? prodRes.value : null
        const inventory = invRes.status === 'fulfilled' ? invRes.value : { barcode: code }

        if (inventory && inventory.item_id) {
          setProductDialog({ open: false, loading: false, product: product, inventory: inventory, error: null })
          setScanInTarget({ product, inventory, locationId })
          setSnack({ open: true, message: `Scanned ${code}`, severity: 'success' })
        } else {
          setProductDialog({ open: true, loading: false, product: product, inventory: { ...inventory, location_id: locationId || inventory.location_id }, error: null })
          setSnack({ open: true, message: `Scanned ${code}`, severity: 'success' })
        }
      })
      .catch(() => {
        setProductDialog({ open: true, loading: false, product: null, inventory: { barcode: code }, error: 'Lookup failed' })
        setSnack({ open: true, message: 'Lookup failed', severity: 'warning' })
      })
  }

  const [scanOutTarget, setScanOutTarget] = useState(null)
  const [scanInTarget, setScanInTarget] = useState(null)

  const handleScanOut = (code, locationId) => {
    setProductDialog({ open: false, loading: true, product: null, error: null })
    Promise.allSettled([fetchProductByBarcode(code), fetchInventoryByBarcode(code)])
      .then(([prodRes, invRes]) => {
        const product = prodRes.status === 'fulfilled' ? prodRes.value : null
        const inventory = invRes.status === 'fulfilled' ? invRes.value : { barcode: code }

        setProductDialog({ open: false, loading: false, product: product, inventory: inventory, error: null })
        setScanOutTarget({ product, inventory, locationId })
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
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center gap-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Home
        </h1>
        <div className="hidden sm:block">
          <LocationFilter selectedIds={selectedLocationIds} onChange={setSelectedLocationIds} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {canScanIn && (
          <button
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-slate-700 rounded-xl font-medium shadow-sm hover:bg-gray-50 transition"
            onClick={() => navigate('/checkin')}
          >
            Start Check In
          </button>
        )}

        {canScanOut && (
          <button
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-medium shadow-md hover:bg-slate-700 transition"
            onClick={() => navigate('/checkout')}
          >
            Start Checkout
          </button>
        )}
      </div>
    </div>

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
                value={loadingDistributed ? '...' : distributedThisMonth.toLocaleString()}
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
                  </div>
                  <InventoryTable mode="widget" limit={7} showFilterBar={false} locationIds={selectedLocationIds} />
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

      {/* FAB (Floating Action Button) - only shown if user has any scan/create permissions */}
      {showFab && (
        <div className="fixed bottom-8 right-8 z-30">
          <div className="relative">

            {showFabMenu && (
              <div className="absolute right-0 bottom-16 grid gap-2 p-2 bg-white border border-gray-200 rounded-xl shadow-xl">
                {canScanIn && (
                  <button
                    className="px-4 py-2 text-sm rounded hover:bg-gray-100 whitespace-nowrap text-right font-medium text-slate-700"
                    onClick={() => { setScanMode('in'); setShowScan(true); setShowFabMenu(false); }}
                  >
                    Scan In (Add/Update)
                  </button>
                )}
                {canScanOut && (
                  <button
                    className="px-4 py-2 text-sm rounded hover:bg-gray-100 whitespace-nowrap text-right font-medium text-slate-700"
                    onClick={() => { setScanMode('out'); setShowScan(true); setShowFabMenu(false); }}
                  >
                    Scan Out
                  </button>
                )}
                {canCreate && (
                  <button
                    className="px-4 py-2 text-sm rounded hover:bg-gray-100 whitespace-nowrap text-right font-medium text-slate-700"
                    onClick={() => { setShowBulkImport(true); setShowFabMenu(false); }}
                  >
                    Bulk Import
                  </button>
                )}
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
      )}

      {/* Scan Sheet Modal */}
      {showScan && (
        <ScanSheet
          onClose={() => setShowScan(false)}
          locations={userLocations}
          onScan={(code, locationId) => {
            setShowScan(false)
            if (scanMode === 'out') handleScanOut(code, locationId)
            else handleScan(code, locationId)
          }}
          onSelectItem={(item, locationId) => {
            setShowScan(false);
            if (scanMode === 'out') {
              setScanOutTarget({
                product: null,
                inventory: item,
                locationId,
              });
            } else {
              setScanInTarget({
                product: null,
                inventory: item,
                locationId,
              });
            }
          }}
        />
      )}

      {/* Scan-Out Quantity Confirmation */}
      {scanOutTarget && (
        <ConfirmQuantityModal
          open={Boolean(scanOutTarget)}
          onClose={() => setScanOutTarget(null)}
          initial={{ barcode: scanOutTarget.inventory?.barcode, quantity: 1, name: scanOutTarget.inventory?.name }}
          maxQuantity={scanOutTarget.inventory?.quantity}
          imageUrl={scanOutTarget.product?.image_front_small_url}
          onConfirm={(payload) => {
            const request = scanOutTarget.inventory?.barcode
              ? scanOutInventory(payload.barcode, payload.quantity, scanOutTarget.locationId)
              : scanOutInventoryByItemId(scanOutTarget.inventory?.item_id, payload.quantity, scanOutTarget.locationId);
          
            request
              .then((res) => {
                console.log('Scan out result', res);
                setSnack({
                  open: true,
                  message: `Scanned out ${payload.quantity} — remaining ${res.remaining_quantity}`,
                  severity: 'success'
                });
                setScanOutTarget(null);
                fetchMonthlyDistributed();
              })
              .catch((err) => {
                console.error('Scan out failed', err);
                const msg = err?.response?.data?.detail || err?.message || 'Scan out failed';
                setSnack({ open: true, message: msg, severity: 'warning' });
              });
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
            increaseInventory(payload.item_id, payload.quantity, scanInTarget.locationId)
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
          product={productDialog.product}
          locations={userLocations}
          onConfirm={(created) => {
            // created is the object returned from the backend createItem
            console.log('Confirmed inventory', created)
            setSnack({ open: true, message: `Created ${created.barcode || created.name} (qty ${created.quantity})`, severity: 'success' })
            // refresh inventory list
            try { queryClient.invalidateQueries(["inventoryItems"]) } catch { /* ignore if no client */ }
          }}
        />
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <BulkImportModal
          open={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onSuccess={(result) => {
            setSnack({
              open: true,
              message: `Imported ${result.successful} items successfully${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
              severity: result.failed > 0 ? 'warning' : 'success'
            })
            // Refresh inventory list
            queryClient.invalidateQueries(["inventoryItems"])
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
      {/* Small help button fixed at bottom-left */}
      <div className="fixed bottom-6 left-6 z-30">
        <Link to="/help" className="px-3 py-2 rounded bg-white border border-gray-200 shadow-sm text-sm text-slate-700 hover:bg-gray-50">
          Help
        </Link>
      </div>
    </div>
  );
};

export default Home;