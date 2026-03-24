import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useAuth } from '../contexts/AuthContext';
import {
  searchInventoryItems,
  fetchInventoryByBarcode,
  completeCheckout,
} from '../services/api';
import ConfirmQuantityModal from '../components/ScanSheet/ConfirmQuantityModal.jsx';

export default function Checkout() {
  const { userLocations } = useAuth();

  const [selectedCheckoutLocationId, setSelectedCheckoutLocationId] = useState(
    userLocations?.length === 1 ? String(userLocations[0].location_id) : ''
  );
  const [cartItems, setCartItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [patronError, setPatronError] = useState('');

  const totalLineItems = cartItems.length;
  const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const videoRef = useRef(null);
  const readerRef = useRef(null);

  const [patronId, setPatronId] = useState('');
  const [patronType, setPatronType] = useState('');
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [checkoutSnack, setCheckoutSnack] = useState({
    open: false,
    message: '',
    severity: 'info',
  });

  const addItemToCart = (item, quantity) => {
    setCartItems((prev) => {
      const existing = prev.find((cartItem) => cartItem.item_id === item.item_id);

      if (existing) {
        return prev.map((cartItem) =>
          cartItem.item_id === item.item_id
            ? {
                ...cartItem,
                quantity: Math.min(
                  cartItem.available_quantity,
                  cartItem.quantity + quantity
                ),
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
            (selectedCheckoutLocationId ? Number(selectedCheckoutLocationId) : null),
        },
      ];
    });
  };

  const increaseCartItem = (itemId) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.item_id === itemId
          ? {
              ...item,
              quantity: Math.min(item.available_quantity, item.quantity + 1),
            }
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
        const result = await fetchInventoryByBarcode(barcodeInput);

        if (!result || !result.item_id) {
          return;
        }

        setCheckoutTarget({
          ...result,
          location_id: selectedCheckoutLocationId
            ? Number(selectedCheckoutLocationId)
            : null,
        });

        setBarcodeInput('');
      } catch (e) {
        console.error('Barcode lookup failed', e);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [barcodeInput, selectedCheckoutLocationId]);

  useEffect(() => {
    if (!checkoutSnack.open) return;
  
    const timer = setTimeout(() => {
      setCheckoutSnack((prev) => ({ ...prev, open: false }));
    }, 3000);
  
    return () => clearTimeout(timer);
  }, [checkoutSnack.open]);

  const stopScanner = () => {
    try {
      readerRef.current?.reset();
    } catch (err) {
      console.warn('Failed to reset reader', err?.message);
    }
  
    try {
      const stream = videoRef.current?.srcObject;
      if (stream && stream.getTracks) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (stopErr) {
            console.warn('Failed to stop track', stopErr?.message);
          }
        });
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } catch (err) {
      console.warn('Failed to stop scanner tracks', err?.message);
    }
  };
  
  const startScanner = async () => {
    try {
      setCheckoutError('');
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
  
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const back = devices.find((d) => /back|rear|environment/i.test(`${d.label}`));
      const id = back?.deviceId ?? devices[0]?.deviceId;
  
      if (!id) {
        setCheckoutError('No camera found.');
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
      setCheckoutError(e.message || 'Camera error');
      setScannerActive(false);
    }
  };

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2 || !selectedCheckoutLocationId) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const results = await searchInventoryItems(
          searchQuery,
          [Number(selectedCheckoutLocationId)]
        );
        setSearchResults(results);
      } catch (e) {
        console.error('Checkout search failed', e);
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, selectedCheckoutLocationId]);

  useEffect(() => {
    if (!scannerActive) {
      stopScanner();
      return;
    }
  
    if (!selectedCheckoutLocationId) {
      setCheckoutError('Select a checkout location before starting the scanner.');
      setScannerActive(false);
      return;
    }
  
    startScanner();
  
    return () => {
      stopScanner();
    };
  }, [scannerActive, selectedCheckoutLocationId]);

  const handleCompleteCheckout = async () => {
    if (cartItems.length === 0) return;
  
    if (!patronId.trim()) {
        setPatronError('Patron ID is required');
      
        setCheckoutSnack({
          open: true,
          message: 'Please enter a Patron ID before completing checkout.',
          severity: 'warning',
        });
        return;
      }
  
    try {
      setIsSubmittingCheckout(true);
      setCheckoutError('');
  
      const payload = {
        patron_id: patronId.trim(),
        patron_type: patronType.trim() || null,
        items: cartItems.map((item) => ({
          item_id: item.item_id,
          location_id: item.location_id,
          quantity: item.quantity,
        })),
      };
  
      const result = await completeCheckout(payload);
  
      setCartItems([]);
      setPatronId('');
      setPatronType('');
      setSearchQuery('');
      setSearchResults([]);
      setBarcodeInput('');
      setCheckoutTarget(null);
      setScannerActive(false);
      stopScanner();
  
      setCheckoutSnack({
        open: true,
        message: result?.message || 'Checkout completed successfully.',
        severity: 'success',
      });
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'Checkout failed. Please try again.';
  
      setCheckoutSnack({
        open: true,
        message: msg,
        severity: 'warning',
      });
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
      <header className="mb-6 flex flex-col gap-4">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Checkout
            </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
                Location Filter
            </label>
            <select
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                value={selectedCheckoutLocationId}
                onChange={(e) => setSelectedCheckoutLocationId(e.target.value)}
            >
                <option value="">All locations</option>
                {userLocations.map((loc) => (
                <option key={loc.location_id} value={String(loc.location_id)}>
                    {loc.name}
                </option>
                ))}
            </select>
            </div>

            <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
                Patron ID <span className="text-red-500">*</span>
            </label>

            <input
                type="text"
                value={patronId}
                onChange={(e) => {
                setPatronId(e.target.value);
                if (e.target.value.trim()) setPatronError('');
                }}
                placeholder="Enter patron ID"
                className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 ${
                patronError
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-gray-300 focus:ring-slate-500'
                }`}
            />

            {patronError && (
                <p className="text-xs text-red-500 mt-1">{patronError}</p>
            )}
            </div>

            <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
                Patron Type
            </label>
            <input
                type="text"
                value={patronType}
                onChange={(e) => setPatronType(e.target.value)}
                placeholder="Patron type (Student, Family, etc.)"
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
                    disabled={!selectedCheckoutLocationId}
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

                {checkoutError && (
                  <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm">
                    {checkoutError}
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
                    setCheckoutError('');
                  }}
                  placeholder={
                    selectedCheckoutLocationId
                      ? 'Scan or type barcode...'
                      : 'Select a checkout location first'
                  }
                  disabled={!selectedCheckoutLocationId}
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
                      setCheckoutError('');
                    }}
                    placeholder={
                      selectedCheckoutLocationId
                        ? 'Start typing an item name...'
                        : 'Select a checkout location first'
                    }
                    disabled={!selectedCheckoutLocationId}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 min-h-[300px] max-h-[400px] overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <div className="p-6 text-sm text-slate-500">
                      {selectedCheckoutLocationId
                        ? 'Search results will appear here.'
                        : 'Choose a checkout location to begin searching.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {searchResults.map((item) => (
                        <button
                          key={item.item_id}
                          type="button"
                          className="w-full text-left p-4 hover:bg-gray-100 transition"
                          onClick={() => setCheckoutTarget(item)}
                        >
                          <div className="font-medium text-slate-800">{item.name}</div>
                          <div className="text-sm text-slate-500 mt-1">
                            Available: {item.quantity}
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
                  Checkout Cart
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Items added during this checkout will appear here.
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
                            Available: {item.available_quantity}
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
                    disabled={cartItems.length === 0 || isSubmittingCheckout}
                    onClick={handleCompleteCheckout}
                    className="px-5 py-3 rounded-xl bg-slate-800 text-white font-semibold shadow-md hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    {isSubmittingCheckout ? 'Completing...' : 'Complete Checkout'}
                    </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {checkoutTarget && (
        <ConfirmQuantityModal
          open={Boolean(checkoutTarget)}
          onClose={() => setCheckoutTarget(null)}
          initial={{
            barcode: checkoutTarget.barcode,
            quantity: 1,
            name: checkoutTarget.name,
          }}
          maxQuantity={checkoutTarget.quantity}
          imageUrl={null}
          onConfirm={(payload) => {
            addItemToCart(checkoutTarget, payload.quantity);
            setCheckoutTarget(null);
            setSearchQuery('');
            setSearchResults([]);
            setBarcodeInput('');
          }}
        />
      )}

    {checkoutSnack.open && (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-300">
        <div
        className={`p-3 text-sm rounded-lg shadow-xl flex items-center justify-between gap-4 ${
            checkoutSnack.severity === 'success'
            ? 'bg-emerald-600 text-white'
            : checkoutSnack.severity === 'warning'
            ? 'bg-amber-500 text-slate-900'
            : 'bg-slate-600 text-white'
        }`}
        >
        {checkoutSnack.message}
        <button
            className="opacity-70 hover:opacity-100"
            onClick={() =>
            setCheckoutSnack((prev) => ({ ...prev, open: false }))
            }
        >
            ×
        </button>
        </div>
    </div>
    )}
    </div>
  );
}