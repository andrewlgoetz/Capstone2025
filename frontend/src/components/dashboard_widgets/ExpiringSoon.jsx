import React, { useState, useMemo } from "react";
import { getItemEmoji } from "./emojiMap";
import ExpandableText from "../common/ExpandableText";

const ExpiringSoon = ({ data = [], days = 14, limit = 15, title = "Expiring Soon" }) => {
  const [thresholdDays, setThresholdDays] = useState(days);

  const today = new Date();

  const expiring = useMemo(() => {
    return (data || [])
      .filter(item => item.expiration_date)
      .map(item => {
        const exp = new Date(item.expiration_date);
        const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
        return { ...item, diffDays, exp };
      })
      .filter(item => item.diffDays >= 0 && item.diffDays <= thresholdDays)
      .sort((a, b) => a.diffDays - b.diffDays)
      .slice(0, limit);
  }, [data, thresholdDays]);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        padding: 16,
        textAlign: "left"
      }}
    >
      {/* Title + Count */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#1f2937" }}>{title}</h3>
        <span style={{
          background: "#1e3a8a",
          color: "#fff",
          padding: "6px 10px",
          borderRadius: 6,
          fontWeight: 600,
        }}>
          {expiring.length}
        </span>
      </div>

      {/* Slider */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 13, color: "#475569", display: "block", marginBottom: 4 }}>
          Show items expiring in ≤ <strong>{thresholdDays}</strong> days
        </label>
        <input
          type="range"
          min="1"
          max="60"
          value={thresholdDays}
          onChange={(e) => setThresholdDays(Number(e.target.value))}
          style={{ width: "100%", cursor: "pointer", accentColor: "#1e3a8a" }}
        />
      </div>

      {expiring.length === 0 ? (
        <p style={{ color: "#6b7280", fontSize: 14 }}>No items expiring soon.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280", textAlign: "left" }}>
              <th style={{ padding: "8px 4px" }}>Item</th>
              <th style={{ padding: "8px 4px" }}>Location</th>
              <th style={{ padding: "8px 4px" }}>Expires</th>
            </tr>
          </thead>
          <tbody>
            {expiring.map((item) => (
              <tr key={item.item_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                {/* ITEM */}
                <td style={{ padding: "8px 4px", whiteSpace: "nowrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#111827" }}>
                    <span style={{ fontSize: "18px" }}>{getItemEmoji(item.name, item.category)}</span>
                    {item.name}
                  </span>
                </td>

                {/* LOCATION (left-aligned, multi-line, expandable notes) */}
                <td style={{ padding: "8px", color: "#6c757d", textAlign: "left" }}>
                {(() => {
                    const fullLocation = [
                    item.location_name,
                    item.location_address,
                    item.location_notes
                    ]
                    .filter(Boolean)
                    .join(" — ");

                    return (
                    <ExpandableText
                        text={fullLocation || "No location info"}
                        maxLength={30}  // tweak to your dashboard width
                    />
                    );
                })()}
                </td>


                {/* EXPIRATION */}
                <td style={{ padding: "10px 4px", fontWeight: 600, color: item.diffDays <= 3 ? "#b91c1c" : "#d97706" }}>
                  {item.diffDays === 0 ? "Today" : `${item.diffDays}d`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ExpiringSoon;
