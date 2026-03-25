import React, { useState } from "react";
import { AVAILABLE_WIDGETS } from "../hooks/useHomeWidgets";

/**
 * Props:
 *   currentSlots  – [key, key]  the 2 currently selected widget keys
 *   onSave        – (newSlots: [key, key]) => void
 *   onClose       – () => void
 */
export default function WidgetPicker({ open, currentSlots, onSave, onClose }) {
  const [draft, setDraft] = useState([...(currentSlots ?? [])]);

  if (!open) return null;

  const toggle = (key) => {
    if (draft.includes(key)) {
      // only deselect if we still have at least 1 remaining
      if (draft.length > 1) setDraft(draft.filter((k) => k !== key));
    } else {
      if (draft.length < 2) {
        setDraft([...draft, key]);
      } else {
        // bump out the oldest pick, add the new one
        setDraft([draft[1], key]);
      }
    }
  };

  const slotLabel = (key) => {
    const idx = draft.indexOf(key);
    if (idx === 0) return "Slot 1";
    if (idx === 1) return "Slot 2";
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* modal card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 z-10">
        {/* header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-slate-800">Customise Widgets</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Pick 2 widgets to show in the Forecasting &amp; Trends section. Your
          choice is saved for next time.
        </p>

        {/* current slot pills */}
        <div className="flex gap-3 mb-5">
          {[0, 1].map((i) => {
            const w = AVAILABLE_WIDGETS.find((w) => w.key === draft[i]);
            return (
              <div
                key={i}
                className="flex-1 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 px-3 py-2 text-center"
              >
                <p className="text-xs text-indigo-400 font-semibold mb-0.5 uppercase tracking-wide">
                  Slot {i + 1}
                </p>
                <p className="text-sm font-bold text-indigo-700 truncate">
                  {w ? w.label : "—"}
                </p>
              </div>
            );
          })}
        </div>

        {/* widget list */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {AVAILABLE_WIDGETS.map((w) => {
            const selected = draft.includes(w.key);
            const label = slotLabel(w.key);
            return (
              <button
                key={w.key}
                onClick={() => toggle(w.key)}
                className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all
                  ${
                    selected
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"
                  }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{w.label}</p>
                  <p className="text-xs text-slate-500 truncate">{w.description}</p>
                </div>
                {label && (
                  <span className="shrink-0 text-xs font-bold bg-indigo-500 text-white rounded-full px-2 py-0.5">
                    {label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* footer */}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (draft.length === 2) {
                onSave(draft);
                onClose();
              }
            }}
            disabled={draft.length !== 2}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
