import React, { useState } from "react";

/**
 * WidgetInfo — a small ❓ icon that shows a tooltip on hover.
 *
 * Usage:
 *   <WidgetInfo text="This chart shows..." />
 */
const WidgetInfo = ({ text }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="Widget info"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 text-[10px] font-bold leading-none"
      >
        ?
      </button>

      {visible && (
        <div
          role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 rounded-lg bg-slate-800 text-white text-xs leading-relaxed px-3 py-2 shadow-lg pointer-events-none"
        >
          {text}
          {/* little arrow */}
          <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800" />
        </div>
      )}
    </div>
  );
};

export default WidgetInfo;
