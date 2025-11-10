import React, { useState, useMemo } from "react";

const EMOJI_BY_CATEGORY = {
    "Pasta": "🍝",
    "Canned Goods": "🥫",
    "Produce": "🥦",
    "Grains": "🌾",
    "Snacks": "🍪",
    "Beverages": "🧃",
    "Dairy": "🧀",
    "Frozen": "🧊",
    "Meat": "🍗",
    "Hygiene": "🧴",
    "Baby": "🍼",
    "Household": "🧻",
  };
  
  function emojiForCategory(category) {
    return EMOJI_BY_CATEGORY[category] || "📦"; // fallback
  }

const LowStockItems = ({ inventory, defaultThreshold = 10 }) => {
  const [threshold, setThreshold] = useState(defaultThreshold);

  const lowStockItems = useMemo(() => {
    return inventory
      .filter((item) => item.quantity <= threshold)
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
        <h2 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "600", color: "#6c757d"}}>
            Low Stock Items
        </h2>

        <div style={{ marginBottom: "12px", display: "flex", gap: "10px", color: "#6c757d" }}>
            <label>Threshold:</label>
            <input
                type="number"
                min="1"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                style={{
                    width: "70px",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                }}
            />
        </div>

        {lowStockItems.length === 0 ? (
            <p style={{ color: "#6c757d" }}>No items are below the selected threshold.</p>
        ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
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
                            <td style={{ padding: "8px" , color: "#6c757d" }}>{item.name}</td>
                            <td style={{ padding: "8px", color: "#6c757d" }}>
                                {item.category || "—"}{"  "}{emojiForCategory(item.category)}  
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
