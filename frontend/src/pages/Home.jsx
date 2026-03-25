import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import WarningIcon from '@mui/icons-material/Warning';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CloseIcon from '@mui/icons-material/Close';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import RedeemIcon from '@mui/icons-material/Redeem'; 

import ScanSheet from '../components/ScanSheet';
import { getItems } from '../services/api';
import DemandLineChart from '../components/dashboard_widgets/DemandLineChart.jsx';
import LowStockTrendChart from '../components/dashboard_widgets/StockTrend.jsx';
import RecentActivity from '../components/home/RecentActivity.jsx';
import CategoryDistribution from '../components/home/CategoryDistribution.jsx';

import { fetchProductByBarcode } from '../services/off';
import WidgetPicker from '../components/WidgetPicker.jsx';
import WidgetRenderer from '../components/WidgetRenderer.jsx';
import { useHomeWidgets } from '../hooks/useHomeWidgets';
import { useDateRange } from '../hooks/useDateRange';
import { useAuth } from '../contexts/AuthContext'
import LocationFilter from '../components/common/LocationFilter.jsx'
import ConfirmInventoryModal from '../components/ScanSheet/ConfirmInventoryModal.jsx'
import ConfirmQuantityModal from '../components/ScanSheet/ConfirmQuantityModal.jsx'
import ConfirmIncreaseModal from '../components/ScanSheet/ConfirmIncreaseModal.jsx'
import BulkImportModal from '../components/home/BulkImportModal.jsx'
import { fetchInventoryByBarcode, scanOutInventory, scanOutInventoryByItemId, increaseInventory, getMonthlyDistributed } from '../services/api'

// Stat Card Component (Total Items, Low Stock, Expiring Soon, This Month Distributed)
const StatCard = ({ icon: Icon, title, value, iconBg, iconColor }) => (
  <div className="p-5 bg-white rounded-xl shadow-sm border border-gray-200">
    <div className="flex items-start justify-between">
      <div className="flex flex-col">
        <div className="text-sm font-medium text-slate-500">{title}</div>
        <div className="text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">{value}</div>
      </div>
      <div className={`w-10 h-10 rounded-full grid place-items-center ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
    </div>
  </div>
);


const Home = () => {
  const [showScan, setShowScan] = useState(false)
  const [scanMode, setScanMode] = useState('in') // 'in' or 'out'
  const [showFabMenu, setShowFabMenu] = useState(false)
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' })
  const [productDialog, setProductDialog] = useState({ open: false, loading: false, product: null, error: null })
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const { slots, updateSlots } = useHomeWidgets()
  const dateRange = useDateRange('last30')

  const { hasPermission, userLocations, selectedLocationIds, setSelectedLocationIds } = useAuth();
  const canViewInventory = hasPermission('inventory:view');
  const canScanIn = hasPermission('barcode:scan_in');
  const canScanOut = hasPermission('barcode:scan_out');
  const canCreate = hasPermission('inventory:create');
  const showFab = canScanIn || canScanOut || canCreate;
  const navigate = useNavigate();

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventoryItems", selectedLocationIds],
    queryFn: () => getItems(selectedLocationIds),
    enabled: canViewInventory,
  });

  const queryClient = useQueryClient();

  const LOW_STOCK_THRESHOLD = 10;
  const totalItems = inventoryItems.length;
  const lowStock = useMemo(
    () => inventoryItems.filter((i) => (i.quantity || 0) <= LOW_STOCK_THRESHOLD),
    [inventoryItems]
  );

  const expiringSoon = useMemo(
    () => inventoryItems.filter((i) => {
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


  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <header className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Home</h1>
              <p className="text-slate-500 mt-1">Overview of your inventory activity.</p>
            </div>
            <LocationFilter selectedIds={selectedLocationIds} onChange={setSelectedLocationIds} />
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
        </header>

        <main className="space-y-6">  
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                icon={Inventory2Icon}
                title="Total Items"
                value={totalItems.toLocaleString()}
                iconBg="bg-blue-100"
                iconColor="text-blue-600"
              />
              <StatCard
                icon={WarningIcon}
                title="Low Stock (≤ 10)"
                value={lowStock.length}
                iconBg="bg-red-100"
                iconColor="text-red-600"
              />
              <StatCard
                icon={AccessTimeIcon}
                title="Expiring Soon (30 days)"
                value={expiringSoon.length}
                iconBg="bg-purple-100"
                iconColor="text-purple-600"
              />
              <StatCard
                icon={RedeemIcon}
                title="This Month Distributed"
                value={loadingDistributed ? '...' : distributedThisMonth.toLocaleString()}
                iconBg="bg-pink-100"
                iconColor="text-pink-500"
              />
            </div>
            
            {/* Category Chart and Inventory Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <CategoryDistribution />
              </div>

            {/* Recent Activity Widget */}
            <div className="lg:col-span-2">
              <RecentActivity />
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

            {/* My Widgets */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-slate-800 tracking-tight">My Widgets</h3>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="text-sm px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Customize
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {slots.map((key) => (
                  <WidgetRenderer key={key} widgetKey={key} dateRange={dateRange} inventory={inventoryItems} />
                ))}
              </div>
            </div>

            <WidgetPicker open={pickerOpen} onClose={() => setPickerOpen(false)} currentSlots={slots} onSave={updateSlots} />

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
                    className="px-4 py-2 text-sm rounded-xl hover:bg-gray-100 whitespace-nowrap text-right font-medium text-slate-700"
                    onClick={() => { setScanMode('in'); setShowScan(true); setShowFabMenu(false); }}
                  >
                    Scan In (Add/Update)
                  </button>
                )}
                {canScanOut && (
                  <button
                    className="px-4 py-2 text-sm rounded-xl hover:bg-gray-100 whitespace-nowrap text-right font-medium text-slate-700"
                    onClick={() => { setScanMode('out'); setShowScan(true); setShowFabMenu(false); }}
                  >
                    Scan Out
                  </button>
                )}
                {canCreate && (
                  <button
                    className="px-4 py-2 text-sm rounded-xl hover:bg-gray-100 whitespace-nowrap text-right font-medium text-slate-700"
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
          open
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
          open
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
          open
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

      {/* Snackbar */}
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