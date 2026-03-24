import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useAuth } from '../contexts/AuthContext';
import {
  searchInventoryItems,
  fetchInventoryByBarcode,
  completeCheckin,
} from '../services/api';

import CheckInNewItemModal from '../components/ScanSheet/CheckInItemModal.jsx';
import ConfirmIncreaseModal from '../components/ScanSheet/ConfirmIncreaseModal.jsx';
import { fetchProductByBarcode } from '../services/off';

export default function CheckIn() {
  const { userLocations } = useAuth();

  const [selectedCheckinLocationId, setSelectedCheckinLocationId] = useState(
    userLocations?.length === 1 ? String(userLocations[0].location_id) : ''
  );
  const [cartItems, setCartItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [checkinError, setCheckinError] = useState('');
  const [donorError, setDonorError] = useState('');

  const [donorName, setDonorName] = useState('');
  const [donorType, setDonorType] = useState('');
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState(false);
  const [checkinSnack, setCheckinSnack] = useState({
    open: false,
    message: '',
    severity: 'info',
  });

  const [scanInTarget, setScanInTarget] = useState(null);
  const [productDialog, setProductDialog] = useState({
    open: false,
    loading: false,
    product: null,
    inventory: null,
    error: null,
  });

  const totalLineItems = cartItems.length;
  const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const videoRef = useRef(null);
  const readerRef = useRef(null);

  const addItemToCart = (item, quantity) => {
    setCartItems((prev) => {
      const existing = prev.find((cartItem) => cartItem.item_id === item.item_id);

      if (existing) {
        return prev.map((cartItem) =>
          cartItem.item_id === item.item_id
            ? {
                ...cartItem,
                quantity: cartItem.quantity + quantity,
              }
            : cartItem
        );
      }

      return [
        ...prev,
        {
          item_id: item.item_id,
          name: item.name,
          barcode: item.barcode ?? null,
          quantity,
          available_quantity: item.quantity,
          location_id:
            item.location_id ??
            (selectedCheckinLocationId ? Number(selectedCheckinLocationId) : null),
        },
      ];
    });
  };

  const increaseCartItem = (itemId) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.item_id === itemId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const decreaseCartItem = (itemId) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.item_id === itemId
          ? { ...item, quantity: Math.max(1, item.quantity - 1) }
          : item
      )
    );
  };

  const removeCartItem = (itemId) => {
    setCartItems((prev) => prev.filter((item) => item.item_id !== itemId));
  };

  useEffect(() => {
    if (!barcodeInput || barcodeInput.length < 4) return;
  
    const timeout = setTimeout(async () => {
      try {
        const [prodRes, invRes] = await Promise.allSettled([
          fetchProductByBarcode(barcodeInput),
          fetchInventoryByBarcode(barcodeInput),
        ]);
  
        const product = prodRes.status === 'fulfilled' ? prodRes.value : null;
        const inventory =
          invRes.status === 'fulfilled'
            ? invRes.value
            : { barcode: barcodeInput };
  
        // Existing inventory item → quantity increase modal
        if (inventory && inventory.item_id) {
          setScanInTarget({
            product,
            inventory: {
              ...inventory,
              location_id:
                inventory.location_id ??
                (selectedCheckinLocationId ? Number(selectedCheckinLocationId) : null),
            },
          });
        } else {
          // New item → full inventory creation modal
          setProductDialog({
            open: true,
            loading: false,
            product,
            inventory: {
              ...inventory,
              barcode: barcodeInput,
              location_id: selectedCheckinLocationId
                ? Number(selectedCheckinLocationId)
                : inventory.location_id || '',
            },
            error: null,
          });
        }
  
        setBarcodeInput('');
        setCheckinError('');
      } catch (e) {
        console.error('Barcode lookup failed', e);
        setCheckinError('Barcode lookup failed.');
      }
    }, 300);
  
    return () => clearTimeout(timeout);
  }, [barcodeInput, selectedCheckinLocationId]);

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2 || !selectedCheckinLocationId) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const results = await searchInventoryItems(
          searchQuery,
          [Number(selectedCheckinLocationId)]
        );
        setSearchResults(results);
      } catch (e) {
        console.error('Check-in search failed', e);
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, selectedCheckinLocationId]);

  useEffect(() => {
    if (!checkinSnack.open) return;

    const timer = setTimeout(() => {
      setCheckinSnack((prev) => ({ ...prev, open: false }));
    }, 3000);

    return () => clearTimeout(timer);
  }, [checkinSnack.open]);

  const stopScanner = () => {
    try {
      readerRef.current?.reset();
    } catch {}

    try {
      const stream = videoRef.current?.srcObject;
      if (stream && stream.getTracks) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch {}
  };

  const startScanner = async () => {
    try {
      setCheckinError('');
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const back = devices.find((d) => /back|rear|environment/i.test(`${d.label}`));
      const id = back?.deviceId ?? devices[0]?.deviceId;

      if (!id) {
        setCheckinError('No camera found.');
        setScannerActive(false);
        return;
      }

      await reader.decodeFromVideoDevice(id, videoRef.current, (result) => {
        if (result) {
          const scannedCode = result.getText();
          setBarcodeInput(scannedCode);
          setSearchQuery('');
        }
      });
    } catch (e) {
      console.error('Camera error', e);
      setCheckinError(e.message || 'Camera error');
      setScannerActive(false);
    }
  };

  useEffect(() => {
    if (!scannerActive) {
      stopScanner();
      return;
    }

    if (!selectedCheckinLocationId) {
      setCheckinError('Select a location before starting the scanner.');
      setScannerActive(false);
      return;
    }

    startScanner();

    return () => {
      stopScanner();
    };
  }, [scannerActive, selectedCheckinLocationId]);

  const handleCompleteCheckin = async () => {
    if (cartItems.length === 0) return;

    if (!donorName.trim()) {
      setDonorError('Donor name is required');
      setCheckinSnack({
        open: true,
        message: 'Please enter a Donor Name before completing check-in.',
        severity: 'warning',
      });
      return;
    }

    try {
      setIsSubmittingCheckin(true);
      setCheckinError('');

      const payload = {
        donor_name: donorName.trim(),
        donor_type: donorType.trim() || null,
        items: cartItems.map((item) => ({
          item_id: item.item_id,
          location_id: item.location_id,
          quantity: item.quantity,
        })),
      };

      const result = await completeCheckin(payload);

      setCartItems([]);
      setDonorName('');
      setDonorType('');
      setSearchQuery('');
      setSearchResults([]);
      setBarcodeInput('');
      setScannerActive(false);
      stopScanner();

      setCheckinSnack({
        open: true,
        message: result?.message || 'Check-in completed successfully.',
        severity: 'success',
      });
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'Check-in failed. Please try again.';

      setCheckinSnack({
        open: true,
        message: msg,
        severity: 'warning',
      });
    } finally {
      setIsSubmittingCheckin(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <header className="mb-6 flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Check In
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Check-In Location
              </label>
              <select
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                value={selectedCheckinLocationId}
                onChange={(e) => setSelectedCheckinLocationId(e.target.value)}
              >
                <option value="">Select a location…</option>
                {userLocations.map((loc) => (
                  <option key={loc.location_id} value={String(loc.location_id)}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Donor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={donorName}
                onChange={(e) => {
                  setDonorName(e.target.value);
                  if (e.target.value.trim()) setDonorError('');
                }}
                placeholder="Enter donor name"
                className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 ${
                  donorError
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-gray-300 focus:ring-slate-500'
                }`}
              />
              {donorError && (
                <p className="text-xs text-red-500 mt-1">{donorError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Donor Type
              </label>
              <input
                type="text"
                value={donorType}
                onChange={(e) => setDonorType(e.target.value)}
                placeholder="Store, Food Drive, Individual, etc."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-[600px]">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-slate-800 tracking-tight">
                Scan or Search Items
              </h2>
            </div>

            <div className="p-4 space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-slate-800">Barcode Scanner</h3>
                    <p className="text-sm text-slate-500">
                      Start the camera to scan items.
                    </p>
                  </div>

                  <button
                    type="button"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      scannerActive
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-slate-800 text-white hover:bg-slate-700'
                    }`}
                    onClick={() => setScannerActive((prev) => !prev)}
                    disabled={!selectedCheckinLocationId}
                  >
                    {scannerActive ? 'Stop Scanner' : 'Start Scanner'}
                  </button>
                </div>

                <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center text-sm text-white">
                  {scannerActive ? (
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <span>Scanner inactive</span>
                  )}
                </div>

                {checkinError && (
                  <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm">
                    {checkinError}
                  </div>
                )}
              </div>

              <div className="grid gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Scan or Enter Barcode
                </label>
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => {
                    setBarcodeInput(e.target.value);
                    setSearchQuery('');
                    setCheckinError('');
                  }}
                  placeholder={
                    selectedCheckinLocationId
                      ? 'Scan or type barcode...'
                      : 'Select a check-in location first'
                  }
                  disabled={!selectedCheckinLocationId}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>

              <div className="space-y-4">
                <div className="grid gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    Search by Item Name
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setBarcodeInput('');
                      setCheckinError('');
                    }}
                    placeholder={
                      selectedCheckinLocationId
                        ? 'Start typing an item name...'
                        : 'Select a check-in location first'
                    }
                    disabled={!selectedCheckinLocationId}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 min-h-[300px] max-h-[400px] overflow-y-auto">
                {searchResults.length === 0 ? (
                <div className="p-6 text-sm text-slate-500 space-y-3">
                  {!selectedCheckinLocationId ? (
                    <div>Choose a check-in location to begin searching.</div>
                  ) : searchQuery.trim().length < 2 ? (
                    <div>Search results will appear here.</div>
                  ) : (
                    <>
                      <div>No matching inventory item found.</div>
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition"
                        onClick={() =>
                          setProductDialog({
                            open: true,
                            loading: false,
                            product: null,
                            inventory: {
                              barcode: '',
                              name: searchQuery.trim(),
                              category: '',
                              location_id: selectedCheckinLocationId
                                ? Number(selectedCheckinLocationId)
                                : '',
                            },
                            error: null,
                          })
                        }
                      >
                        Add "{searchQuery.trim()}" as new item
                      </button>
                    </>
                  )}
                </div>
              ) : (
                    <div className="divide-y divide-gray-200">
                      {searchResults.map((item) => (
                      <button
                        key={item.item_id}
                        type="button"
                        className="w-full text-left p-4 hover:bg-gray-100 transition"
                        onClick={() =>
                          setScanInTarget({
                            product: null,
                            inventory: {
                              ...item,
                              location_id:
                                item.location_id ??
                                (selectedCheckinLocationId ? Number(selectedCheckinLocationId) : null),
                            },
                          })
                        }
                      >
                        <div className="font-medium text-slate-800">{item.name}</div>
                        <div className="text-sm text-slate-500 mt-1">
                          Current stock: {item.quantity}
                        </div>
                      </button>
                    ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-[600px]">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-800 tracking-tight">
                  Donation Cart
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Items added during this check-in will appear here.
                </p>
              </div>

              <div className="text-sm font-medium text-slate-500">
                {totalLineItems} {totalLineItems === 1 ? 'item' : 'items'}
              </div>
            </div>

            <div className="p-4 flex flex-col gap-4 h-[calc(100%-81px)]">
              <div className="flex-1 overflow-y-auto space-y-3">
                {cartItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-slate-500">
                    No items added yet.
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.item_id} className="p-3 border rounded-xl">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-slate-800">{item.name}</div>
                          <div className="text-sm text-slate-500 mt-1">
                            Qty: {item.quantity}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            Current stock: {item.available_quantity}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="w-8 h-8 rounded-lg border border-gray-300 text-slate-700 hover:bg-gray-50"
                            onClick={() => decreaseCartItem(item.item_id)}
                          >
                            -
                          </button>

                          <button
                            type="button"
                            className="w-8 h-8 rounded-lg border border-gray-300 text-slate-700 hover:bg-gray-50"
                            onClick={() => increaseCartItem(item.item_id)}
                          >
                            +
                          </button>

                          <button
                            type="button"
                            className="px-3 py-2 rounded-lg text-sm border border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => removeCartItem(item.item_id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-500">Total items</div>
                  <div className="text-2xl font-bold text-slate-900">{totalQuantity}</div>
                </div>

                <button
                  type="button"
                  disabled={cartItems.length === 0 || isSubmittingCheckin}
                  onClick={handleCompleteCheckin}
                  className="px-5 py-3 rounded-xl bg-slate-800 text-white font-semibold shadow-md hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingCheckin ? 'Completing...' : 'Complete Check In'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {scanInTarget && (
      <ConfirmIncreaseModal
        open={Boolean(scanInTarget)}
        onClose={() => setScanInTarget(null)}
        initial={{
          barcode: scanInTarget.inventory?.barcode,
          item_id: scanInTarget.inventory?.item_id,
          name: scanInTarget.inventory?.name,
          category: scanInTarget.inventory?.category,
        }}
        imageUrl={scanInTarget.product?.image_front_small_url}
        onConfirm={(payload) => {
          addItemToCart(
            {
              ...scanInTarget.inventory,
              item_id: payload.item_id,
            },
            payload.quantity
          );
          setScanInTarget(null);
          setSearchQuery('');
          setSearchResults([]);
          setBarcodeInput('');
        }}
      />
    )}

      {checkinSnack.open && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-300">
          <div
            className={`p-3 text-sm rounded-lg shadow-xl flex items-center justify-between gap-4 ${
              checkinSnack.severity === 'success'
                ? 'bg-emerald-600 text-white'
                : checkinSnack.severity === 'warning'
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-600 text-white'
            }`}
          >
            {checkinSnack.message}
            <button
              className="opacity-70 hover:opacity-100"
              onClick={() => setCheckinSnack((prev) => ({ ...prev, open: false }))}
            >
              ×
            </button>
          </div>
        </div>
      )}

    {productDialog.open && (
      <CheckInNewItemModal
        open={productDialog.open}
        onClose={() =>
          setProductDialog({
            open: false,
            loading: false,
            product: null,
            inventory: null,
            error: null,
          })
        }
        initial={{
          barcode: productDialog.inventory?.barcode || '',
          name: productDialog.inventory?.name || '',
          category: productDialog.inventory?.category || '',
          location_id:
            productDialog.inventory?.location_id ??
            (selectedCheckinLocationId ? Number(selectedCheckinLocationId) : ''),
        }}
        imageUrl={productDialog.product?.image_front_small_url}
        product={productDialog.product}
        locations={userLocations}
        onConfirm={({ createdItem, quantityToCheckIn }) => {
          addItemToCart(
            {
              item_id: createdItem.item_id,
              name: createdItem.name,
              barcode: createdItem.barcode ?? null,
              quantity: 0,
              available_quantity: 0,
              location_id:
                createdItem.location_id ??
                (selectedCheckinLocationId
                  ? Number(selectedCheckinLocationId)
                  : null),
            },
            quantityToCheckIn
          );

          setProductDialog({
            open: false,
            loading: false,
            product: null,
            inventory: null,
            error: null,
          });

          setSearchQuery('');
          setSearchResults([]);
          setBarcodeInput('');
        }}
      />
    )}
    </div>
  );
}