import React, { useState, useMemo } from "react";
import { getItemEmoji } from "./emojiMap";

const LowStockItems = ({ inventory, defaultThreshold = 10 }) => {
  const maxQuantity = useMemo(
    () => Math.max(...inventory.map(i => i.quantity || 0), 1),
    [inventory]
  );

  const [threshold, setThreshold] = useState(defaultThreshold);

  const lowStockItems = useMemo(() => {
    return inventory
      .filter(item => typeof item.quantity === "number" && item.quantity <= threshold)
      .sort((a, b) => a.quantity - b.quantity);
  }, [inventory, threshold]);

  return (
    <div
      style={{
        background: "white",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
      }}
    >
      {/* HEADER WITH COUNT BADGE */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#6c757d", margin: 0 }}>
          Low Stock Items
        </h2>

        <span
          style={{
            background: "#1e3a8a",
            color: "white",
            padding: "6px 10px",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "14px",
            minWidth: "32px",
            textAlign: "center",
          }}
        >
          {lowStockItems.length}
        </span>
      </div>

      {/* DYNAMIC SLIDER */}
      <div style={{ marginBottom: "18px" }}>
        <label style={{ fontSize: "14px", color: "#6c757d", marginBottom: "6px", display: "block" }}>
          Show items with quantity ≤ <strong>{threshold}</strong>
        </label>

        <input
          type="range"
          min="1"
          max={maxQuantity}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          style={{
            width: "100%",
            cursor: "pointer",
            accentColor: "#0072B2",
          }}
        />
      </div>

      {lowStockItems.length === 0 ? (
        <p style={{ color: "#6c757d" }}>No items are below the selected threshold.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: "8px", color: "#6c757d" }}>Item</th>
              <th style={{ padding: "8px", color: "#6c757d" }}>Category</th>
              <th style={{ padding: "8px", color: "#6c757d" }}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {lowStockItems.map((item) => (
              <tr key={item.item_id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px", color: "#6c757d" }}>
                {getItemEmoji(item.name, item.category)}{"  "}{item.name}</td>
                <td style={{ padding: "8px", color: "#6c757d" }}>
                {item.category || "—"}
                </td>
                <td style={{ padding: "8px", fontWeight: "600", color: "#E15759" }}>
                  {item.quantity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default LowStockItems;
