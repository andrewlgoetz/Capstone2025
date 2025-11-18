import React, { useState } from "react";

const ExpandableText = ({ text, maxLength = 50 }) => {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const isLong = text.length > maxLength;
  const displayText = expanded ? text : text.slice(0, maxLength) + (isLong ? "..." : "");

  return (
    <span style={{ cursor: isLong ? "pointer" : "default" }} onClick={() => isLong && setExpanded(!expanded)}>
      {displayText}
      {isLong && (
        <span style={{ color: "#4F46E5", marginLeft: "6px" }}>
          {expanded ? "(show less)" : "(more)"}
        </span>
      )}
    </span>
  );
};

export default ExpandableText;
