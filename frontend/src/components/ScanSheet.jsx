import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { searchInventoryItems } from '../services/api';

const ScanSheet = ({ onClose, onScan, onSelectItem, locations = [] }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [deviceId, setDeviceId] = useState(null);
  const [locationId, setLocationId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const videoRef = useRef(null);
  const readerRef = useRef(null);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
  
    const timeout = setTimeout(async () => {
      try {
        const res = await searchInventoryItems(searchQuery, locationId);
        setSearchResults(res);
      } catch (e) {
        console.error("Search failed", e);
      }
    }, 300);
  
    return () => clearTimeout(timeout);
  }, [searchQuery, locationId]);

  // Auto-select if user has exactly one location
  useEffect(() => {
    if (locations.length === 1) setLocationId(String(locations[0].location_id));
  }, [locations]);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    const videoEl = videoRef.current;

    async function start() {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const back = devices.find(d => /back|rear|environment/i.test(`${d.label}`));
        const id = back?.deviceId ?? devices[0]?.deviceId;
        setDeviceId(id);

        await reader.decodeFromVideoDevice(id, videoRef.current, (result) => {
          if (result) setCode(result.getText());
        });
      } catch (e) {
        setError(e.message || 'Camera error');
      }
    }

    start();

    return () => {
      try { readerRef.current?.reset(); } catch (err) { console.warn('Failed to reset reader during cleanup', err?.message); }
      try {
        const stream = videoEl?.srcObject;
        if (stream && stream.getTracks) stream.getTracks().forEach((t) => { try { t.stop(); } catch (stopErr) { console.warn('Failed to stop track', stopErr?.message); } });
        if (videoEl) videoEl.srcObject = null;
      } catch (err) { console.warn('Failed to stop media tracks', err?.message); }
      try { setDeviceId(null); } catch { /* ignore */ }
    };
  }, []);

  const stopCamera = () => {
    try { readerRef.current?.reset(); } catch (err) { console.warn('Failed to reset reader', err?.message); }
    try {
      const stream = videoRef.current?.srcObject;
      if (stream && stream.getTracks) stream.getTracks().forEach((t) => { try { t.stop(); } catch (stopErr) { console.warn('Failed to stop track', stopErr?.message); } });
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch (err) { console.warn('Failed to stop tracks', err?.message); }
    setDeviceId(null);
  };

  const handleSubmit = () => {
    if (code.trim()) {
      onScan?.(code.trim(), locationId ? Number(locationId) : null);
      stopCamera();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
  
      <div
        className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl shadow-black/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
          <h2 className="font-semibold text-lg m-0">Scan Item</h2>
          <button
            className="px-2 py-1 border border-gray-200 rounded-lg text-sm transition hover:bg-gray-50"
            onClick={() => {
              stopCamera();
              onClose();
            }}
          >
            Cancel
          </button>
        </div>
  
        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">

          {/* Location selector — prominent, top of sheet */}
          {locations.length > 0 && (
            <div className="grid gap-1">
              <label className="text-sm font-semibold text-gray-700">Location</label>
              <select
                className={`px-3 py-2.5 border-2 rounded-xl w-full text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  locationId ? 'border-indigo-500 text-gray-900' : 'border-amber-400 text-gray-400'
                }`}
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">Select a location…</option>
                {locations.map((loc) => (
                  <option key={loc.location_id} value={String(loc.location_id)}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
  
          {error && (
            <div className="p-3 rounded-lg border border-yellow-400 bg-amber-100 text-amber-900 text-sm">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}

          {/* Camera preview */}
          <div className="relative aspect-video w-full rounded-xl bg-gray-900 overflow-hidden flex items-center justify-center text-white shrink-0">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {!deviceId && (
              <p className="absolute text-xs opacity-80 p-2">Initializing camera…</p>
            )}
          </div>

          {/* Barcode field */}
          <div className="grid gap-0.5">
            <label className="text-sm text-gray-600">Detected / manual barcode</label>
            <input
              className="px-3 py-2 border border-gray-300 rounded-xl w-full text-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="000000000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setSearchQuery('');
              }}
            />
          </div>
  
          <div className="grid gap-0.5">
            <label className="text-sm text-gray-600">Search by Item Name</label>
            <input
              type="text"
              placeholder="Or search by name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCode('');
              }}
              className="px-3 py-2 border border-gray-300 rounded-xl w-full text-sm"
            />
          </div>
  
          {searchResults.length > 0 && (
            <div className="border rounded-xl overflow-hidden bg-white">
              {searchResults.map((item) => (
                <button
                  type="button"
                  key={item.item_id}
                  className="w-full text-left p-3 hover:bg-gray-100 border-b last:border-b-0"
                  onClick={() => {
                    stopCamera();
                    onSelectItem?.(item, locationId ? Number(locationId) : null);
                    onClose();
                  }}
                >
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500">
                    Qty: {item.quantity}
                  </div>
                </button>
              ))}
            </div>
          )}
  
          <p className="text-xs text-gray-500 m-0">
            Tip: good lighting, hold the barcode flat. ZXing decodes UPC/EAN/Code128 fast.
          </p>
        </div>
  
        {/* Footer */}
        <div className="p-4 flex justify-end gap-2 w-full border-t border-gray-100 bg-white shrink-0">
          <button
            className="px-3 py-2 border border-gray-300 rounded-xl transition hover:bg-gray-50"
            onClick={() => {
              stopCamera();
              onClose();
            }}
          >
            Cancel
          </button>
          <button
            className="px-3 py-2 rounded-xl bg-gray-900 text-white transition disabled:opacity-50"
            onClick={handleSubmit}
            disabled={!code.trim()}
          >
            Use this code
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScanSheet;
