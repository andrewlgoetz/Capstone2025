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
  { keywords: ["apple", "apples"], emoji: "🍎" },
  { keywords: ["banana", "bananas"], emoji: "🍌" },
  { keywords: ["butter"], emoji: "🧈" },
  { keywords: ["orange", "oranges", "clementine", "clementines"], emoji: "🍊" },
  { keywords: ["grape", "grapes"], emoji: "🍇" },
  { keywords: ["blueberry", "blueberries"], emoji: "🫐" },
  { keywords: ["strawberry", "strawberries"], emoji: "🍓" },
  { keywords: ["watermelon"], emoji: "🍉" },
  { keywords: ["pineapple"], emoji: "🍍" },
  { keywords: ["avocado", "avocados"], emoji: "🥑" },
  { keywords: ["kiwi", "kiwis"], emoji: "🥝" },

  { keywords: ["tomato", "tomatoes"], emoji: "🍅" },
  { keywords: ["broccoli"], emoji: "🥦" },
  { keywords: ["carrot", "carrots"], emoji: "🥕" },
  { keywords: ["potato", "potatoes"], emoji: "🥔" },
  { keywords: ["onion", "onions"], emoji: "🧅" },
  { keywords: ["lettuce", "salad"], emoji: "🥬" },
  { keywords: ["spinach"], emoji: "🥬" },
  { keywords: ["cucumber", "cucumbers"], emoji: "🥒" },
  { keywords: ["garlic"], emoji: "🧄" },
  { keywords: ["corn"], emoji: "🌽" },
  { keywords: ["pea", "peas"], emoji: "🫛" },

  { keywords: ["bread", "loaf"], emoji: "🍞" },
  { keywords: ["milk"], emoji: "🥛" },
  { keywords: ["cheese"], emoji: "🧀" },
  { keywords: ["yogurt"], emoji: "🥣" },
  { keywords: ["egg", "eggs"], emoji: "🥚" },

  { keywords: ["pasta", "noodle", "noodles"], emoji: "🍝" },
  { keywords: ["rice"], emoji: "🍚" },
  { keywords: ["beans"], emoji: "🫘" },
  { keywords: ["soup"], emoji: "🍲" },

  { keywords: ["chicken"], emoji: "🍗" },
  { keywords: ["beef"], emoji: "🥩" },
  { keywords: ["pork"], emoji: "🐖" },
  { keywords: ["fish", "salmon"], emoji: "🐟" },
  { keywords: ["shrimp"], emoji: "🍤" },
  { keywords: ["bacon"], emoji: "🥓" },

  { keywords: ["pepper", "peppers"], emoji: "🌶️" },
  { keywords: ["mushroom", "mushrooms"], emoji: "🍄" },

  { keywords: ["hotdog", "hotdogs"], emoji: "🌭" },
  { keywords: ["burger", "burgers"], emoji: "🍔" },
  { keywords: ["pizza"], emoji: "🍕" },
  { keywords: ["taco", "tacos"], emoji: "🌮" },
  { keywords: ["burrito", "burritos"], emoji: "🌯" },

  { keywords: ["popcorn"], emoji: "🍿" },
  { keywords: ["cookie", "cookies"], emoji: "🍪" },
  { keywords: ["cake", "cakes"], emoji: "🍰" },
  { keywords: ["donut", "donuts"], emoji: "🍩" },
  { keywords: ["chocolate"], emoji: "🍫" },
  { keywords: ["honey"], emoji: "🍯" },

  { keywords: ["water"], emoji: "💧" },
  { keywords: ["juice"], emoji: "🧃" },
  { keywords: ["coffee"], emoji: "☕" },
  { keywords: ["tea"], emoji: "🫖" },

  { keywords: ["lemon", "lemons"], emoji: "🍋" },
  { keywords: ["lime", "limes"], emoji: "🍈" },

  { keywords: ["oil", "olive oil"], emoji: "🫒" },
  { keywords: ["salt"], emoji: "🧂" },
];

// Function to get emoji for an item
export function getItemEmoji(name, category) {
  // Keyword detection in item name first
  const lower = name.toLowerCase();
  for (const entry of ITEM_KEYWORD_EMOJIS) {
    if (entry.keywords.some(word => lower.includes(word))) {
      return entry.emoji;
    }
  }

  // Category-level emoji as fallback
  if (category && CATEGORY_EMOJIS[category]) {
    return CATEGORY_EMOJIS[category];
  }

  // Default fallback
  return "📦";
}