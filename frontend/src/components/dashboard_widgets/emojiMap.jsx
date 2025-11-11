// Core category → emoji mapping
export const CATEGORY_EMOJIS = {
    "Produce": "🥦",
    "Fruit": "🍎",
    "Vegetables": "🥕",
    "Canned Goods": "🥫",
    "Beverages": "🧃",
    "Snacks": "🍪",
    "Grains": "🌾",
    "Dairy": "🧀",
    "Meat": "🍗",
    "Protein": "🥩",
    "Frozen": "🧊",
    "Bakery": "🍞",
    "Condiments": "🧂",
    "Baby": "🍼",
    "Household": "🧻",
    "Hygiene": "🧴",
  };
  
  // Keyword → emoji mapping for specific item names
  export const ITEM_KEYWORD_EMOJIS = [
    { keywords: ["apple"], emoji: "🍎" },
    { keywords: ["banana"], emoji: "🍌" },
    { keywords: ["orange", "clementine"], emoji: "🍊" },
    { keywords: ["grape"], emoji: "🍇" },
    { keywords: ["berry"], emoji: "🫐" },
    { keywords: ["strawberry"], emoji: "🍓" },
    { keywords: ["tomato"], emoji: "🍅" },
    { keywords: ["broccoli"], emoji: "🥦" },
    { keywords: ["carrot"], emoji: "🥕" },
    { keywords: ["potato"], emoji: "🥔" },
    { keywords: ["onion"], emoji: "🧅" },
    { keywords: ["lettuce", "salad"], emoji: "🥬" },
    { keywords: ["bread"], emoji: "🍞" },
    { keywords: ["milk"], emoji: "🥛" },
    { keywords: ["cheese"], emoji: "🧀" },
    { keywords: ["yogurt"], emoji: "🥣" },
    { keywords: ["pasta", "noodle"], emoji: "🍝" },
    { keywords: ["rice"], emoji: "🍚" },
    { keywords: ["beans"], emoji: "🫘" },
    { keywords: ["soup"], emoji: "🍲" },
    { keywords: ["chicken"], emoji: "🍗" },
    { keywords: ["beef"], emoji: "🥩" },
    { keywords: ["fish", "salmon"], emoji: "🐟" },
    { keywords: ["water"], emoji: "💧" },
    { keywords: ["juice"], emoji: "🧃" },
    { keywords: ["coffee"], emoji: "☕" },
    { keywords: ["tea"], emoji: "🍵" },
    { keywords: ["chips"], emoji: "🍟" },
    { keywords: ["cookie"], emoji: "🍪" },
    { keywords: ["cake"], emoji: "🍰" },
    { keywords: ["chocolate"], emoji: "🍫" },
  ];
  
  // Main helper function
  export function getItemEmoji(name, category) {
    // Category-level emoji first
    if (category && CATEGORY_EMOJIS[category]) {
      return CATEGORY_EMOJIS[category];
    }
  
    // Keyword detection in item name
    const lower = name.toLowerCase();
    for (const entry of ITEM_KEYWORD_EMOJIS) {
      if (entry.keywords.some(word => lower.includes(word))) {
        return entry.emoji;
      }
    }
  
    // Fallback
    return "📦";
  }
  