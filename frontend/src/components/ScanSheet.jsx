import React, { useEffect, useRef, useState } from 'react';
// We are replacing Material UI components with standard HTML elements and Tailwind classes
import { BrowserMultiFormatReader } from '@zxing/browser';

// Replicating the structure and classes from ScanSheet.module.css with Tailwind
const ScanSheet = ({ onClose, onScan }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [deviceId, setDeviceId] = useState(null);

  const videoRef = useRef(null);
  const readerRef = useRef(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
  const videoEl = videoRef.current

    async function start() {
      try {
        // Pick back camera if possible
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const back = devices.find(d =>
          /back|rear|environment/i.test(`${d.label}`)
        );
        const id = back?.deviceId ?? devices[0]?.deviceId;
        setDeviceId(id);

        await reader.decodeFromVideoDevice(
          id,
          videoRef.current,
          (result) => {
              if (result) {
                const text = result.getText();
                setCode(text);
                // Auto-submit logic is commented out, leaving manual as in original
                // onScan?.(text); onClose();
              }
            }
        );
      } catch (e) {
        setError(e.message || 'Camera error');
      }
    }

    start();

    // Cleanup: stop the reader and any active media tracks
    return () => {
      try {
        readerRef.current?.reset();
      } catch (err) {
        console.warn('Failed to reset reader during cleanup', err?.message)
      }

      try {
        const stream = videoEl?.srcObject
        if (stream && stream.getTracks) {
          stream.getTracks().forEach((t) => {
            try { t.stop() } catch (stopErr) { console.warn('Failed to stop track', stopErr?.message) }
          })
        }
        if (videoEl) videoEl.srcObject = null
      } catch (err) {
        console.warn('Failed to stop media tracks', err?.message)
      }

  try { setDeviceId(null) } catch { /* ignore */ }
    };
  }, []);

  const handleSubmit = () => {
    if (code.trim()) {
      onScan?.(code.trim());
      // stop camera before closing
      try { readerRef.current?.reset(); } catch (err) { console.warn('Failed to reset reader', err?.message) }
      try {
        const stream = videoRef.current?.srcObject
        if (stream && stream.getTracks) stream.getTracks().forEach((t) => { try { t.stop() } catch (stopErr) { console.warn('Failed to stop track', stopErr?.message) } })
        if (videoRef.current) videoRef.current.srcObject = null
      } catch (err) { console.warn('Failed to stop tracks on submit', err?.message) }
      setDeviceId(null)
      onClose();
    }
  };

  return (
    // Overlay (Fixed full screen, z-50, grid)
    <div className="fixed inset-0 z-50 grid" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Sheet (Slide-in panel, right-aligned, max-w-xl) */}
      <div 
        className="relative ml-auto h-full w-full max-w-xl bg-white shadow-xl shadow-black/10" 
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the sheet
      >
        {/* Header (flex, space-between, padding, border-b) */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="font-semibold text-lg m-0">Scan Item</h2>
          {/* Close Button */}
          <button 
            className="px-2 py-1 border border-gray-200 rounded-lg text-sm transition hover:bg-gray-50"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>

        {/* Content (padding, grid, gap) */}
        <div className="p-4 grid gap-3">
          {/* Warning (Alert equivalent) */}
          {error && (
            <div className="p-3 rounded-lg border border-yellow-400 bg-amber-100 text-amber-900 text-sm">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}

          {/* Preview (Video container) */}
          <div className="relative aspect-video w-full rounded-xl bg-gray-900 overflow-hidden flex items-center justify-center text-white">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {!deviceId && (
              <p className="absolute text-xs opacity-80 p-2">
                Initializing camera…
              </p>
            )}
          </div>

          {/* Field (Input) */}
          <div className="grid gap-0.5">
            <label className="text-sm text-gray-600">Detected / manual barcode</label>
            <input
              className="px-3 py-2 border border-gray-300 rounded-xl w-full text-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="000000000000"
              value={code}
              onChange={e => setCode(e.target.value)}
            />
          </div>

          {/* Tip */}
          <p className="text-xs text-gray-500 m-0">
            Tip: good lighting, hold the barcode flat. ZXing decodes UPC/EAN/Code128 fast.
          </p>
        </div>
        
        {/* Actions (Footer, right-aligned buttons) */}
        <div className="absolute bottom-0 right-0 p-4 flex justify-end gap-2 w-full border-t border-gray-100 bg-white">
          <button 
            className="px-3 py-2 border border-gray-300 rounded-xl transition hover:bg-gray-50"
            onClick={() => {
              try { readerRef.current?.reset(); } catch (err) { console.warn('Failed to reset reader on cancel', err?.message) }
              try {
                const stream = videoRef.current?.srcObject
                if (stream && stream.getTracks) stream.getTracks().forEach((t) => { try { t.stop() } catch (stopErr) { console.warn('Failed to stop track', stopErr?.message) } })
                if (videoRef.current) videoRef.current.srcObject = null
              } catch (err) { console.warn('Failed to stop tracks on cancel', err?.message) }
              setDeviceId(null)
              onClose()
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