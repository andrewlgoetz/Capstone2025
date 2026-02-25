CATEGORY_KEYWORDS = {
    "Canned Goods": [
        "canned foods", "beans", "canned", "soups"
    ],
    "Snacks": [
        "snacks", "nuts", "seeds", "crisps", "biscuits", "chips"
    ],
    "Spreads": [
        "spreads", "sauces", "condiments"
    ],
    "Frozen": [
        "frozen foods", "frozen desserts"
    ],
    "Meat": [
        "meats", "fish", "seafoods", "chickens", "beef", "pork"
    ],
    "Grains": [
        "pastas", "rices", "cereals", "breads", "flours", "grains", "oats", "breakfast cereals"
    ],
    "Refrigerated": [
        "refrigerated", "fresh foods", "meals"
    ],
    "Produce": [
        "fruits", "fresh fruits", "vegetables", "produce"
    ],
    "Beverages": [
        "beverages", "juices", "coffees", "teas", "waters", "sodas"
    ],
    "Dairy": [
        "dairies", "milks", "cheeses", "butters", "yogurts", "eggs", "laitiers"
    ],
}

# Export category list (used by both frontend and backend)
NONPROFIT_CATEGORIES = list(CATEGORY_KEYWORDS.keys())

# Pre-build reverse lookup for efficiency (don't do this in the function!)
_KEYWORD_TO_CATEGORY = {}
for category, keywords in CATEGORY_KEYWORDS.items():
    for keyword in keywords:
        _KEYWORD_TO_CATEGORY[keyword] = category


def map_off_to_nonprofit_category(off_categories: str) -> str:
    """
    Map OpenFoodFacts categories to nonprofit categories.

    Much faster and cleaner than the previous approach.
    """
    if not off_categories:
        return "Other"

    categories_lower = off_categories.lower()
    # print(f"categories: {off_categories}")

    # Check keywords (they're already sorted by frequency in the reverse dict)
    for keyword, category in _KEYWORD_TO_CATEGORY.items():
        if keyword in categories_lower:
            return category

    return "Other"