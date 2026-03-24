# Granular foodbank categories with Open Food Facts keyword matching.
# Each category has a list of keywords that may appear in OFF categories strings.
# Used for: DB seeding, OFF category matching on barcode scan.

FOODBANK_CATEGORIES = [
    # --- Soups (Canned) ---
    {"name": "Canned Soup - Chicken / Meat",       "description": "Chicken noodle, beef stew, meat-based canned soups",           "display_order": 10},
    {"name": "Canned Soup - Vegetable",             "description": "Minestrone, vegetable medley canned soups",                   "display_order": 11},
    {"name": "Canned Soup - Tomato",                "description": "Tomato, tomato basil canned soups",                           "display_order": 12},
    {"name": "Canned Soup - Cream / Bisque",        "description": "Cream of mushroom, cream of chicken, bisque",                "display_order": 13},
    {"name": "Canned Soup - Bean / Lentil",         "description": "Lentil, split pea, bean canned soups",                       "display_order": 14},
    {"name": "Canned Soup - Other",                 "description": "Canned soups not listed above",                              "display_order": 15},
    # --- Canned Proteins ---
    {"name": "Canned Fish",                         "description": "Tuna, salmon, sardines, mackerel in cans",                   "display_order": 20},
    {"name": "Canned Meat",                         "description": "Canned chicken, Spam, corned beef, other canned meats",      "display_order": 21},
    {"name": "Canned Beans",                        "description": "Black beans, kidney beans, chickpeas, baked beans (canned)", "display_order": 22},
    {"name": "Canned Protein - Other",              "description": "Other canned protein not listed above",                      "display_order": 23},
    # --- Fresh Meat ---
    {"name": "Meat - Ground Beef",                  "description": "Ground beef, beef mince",                                    "display_order": 30},
    {"name": "Meat - Beef (Cuts / Roast)",          "description": "Steak, roast beef, brisket, beef cuts",                     "display_order": 31},
    {"name": "Meat - Ground Pork",                  "description": "Ground pork, pork mince",                                   "display_order": 32},
    {"name": "Meat - Pork (Chops / Roast)",         "description": "Pork chops, pork roast, pork tenderloin",                  "display_order": 33},
    {"name": "Meat - Bacon / Ham",                  "description": "Bacon, ham, prosciutto, deli cold cuts",                    "display_order": 34},
    {"name": "Meat - Sausage",                      "description": "Fresh sausage, bratwurst, chorizo, breakfast links",        "display_order": 35},
    {"name": "Meat - Chicken (Whole / Pieces)",     "description": "Chicken breasts, thighs, wings, whole chicken",            "display_order": 36},
    {"name": "Meat - Ground Poultry",               "description": "Ground chicken, ground turkey",                             "display_order": 37},
    {"name": "Meat - Turkey",                       "description": "Turkey breast, whole turkey, turkey cuts",                  "display_order": 38},
    {"name": "Meat - Fish / Seafood",               "description": "Fresh fish fillets, shrimp, crab, other fresh seafood",    "display_order": 39},
    {"name": "Meat - Other",                        "description": "Lamb, veal, game meat, or other fresh meat",               "display_order": 40},
    # --- Pasta & Noodles ---
    {"name": "Pasta - Long",                        "description": "Spaghetti, linguine, fettuccine",                           "display_order": 50},
    {"name": "Pasta - Short",                       "description": "Penne, rotini, fusilli, macaroni",                          "display_order": 51},
    {"name": "Pasta - Mac & Cheese Kit",            "description": "Boxed mac and cheese, Kraft Dinner",                        "display_order": 52},
    {"name": "Noodles - Instant / Asian",           "description": "Instant ramen, rice noodles, chow mein noodles",            "display_order": 53},
    {"name": "Pasta - Other",                       "description": "Pasta or noodles not listed above",                         "display_order": 54},
    # --- Rice & Grains ---
    {"name": "Rice - White",                        "description": "White rice, jasmine rice, basmati rice",                    "display_order": 60},
    {"name": "Rice - Brown / Whole Grain",          "description": "Brown rice, wild rice",                                     "display_order": 61},
    {"name": "Other Grains",                        "description": "Quinoa, barley, couscous, bulgur",                          "display_order": 62},
    {"name": "Dried Beans / Lentils",               "description": "Dried lentils, split peas, dried chickpeas, dried beans",   "display_order": 63},
    {"name": "Grains - Other",                      "description": "Grains or dried goods not listed above",                    "display_order": 64},
    # --- Breakfast ---
    {"name": "Cereal - Ready to Eat",               "description": "Cold cereal, cornflakes, oat rings, granola cereal",        "display_order": 70},
    {"name": "Cereal - Hot / Oatmeal",              "description": "Oats, cream of wheat, porridge, instant oatmeal",          "display_order": 71},
    # --- Bread & Baked Goods ---
    {"name": "Bread",                               "description": "Sliced bread, buns, rolls, wraps, tortillas",              "display_order": 80},
    {"name": "Crackers",                            "description": "Crackers, rice cakes, crispbreads",                         "display_order": 81},
    {"name": "Flour / Baking Supplies",             "description": "Flour, baking powder, baking soda, sugar, baking mixes",   "display_order": 82},
    {"name": "Baked Goods - Other",                 "description": "Muffins, pastries, cakes, or other baked items",           "display_order": 83},
    # --- Canned Vegetables ---
    {"name": "Canned Vegetables - Corn",            "description": "Canned or jarred corn",                                     "display_order": 90},
    {"name": "Canned Vegetables - Peas",            "description": "Canned peas, canned green beans",                          "display_order": 91},
    {"name": "Canned Vegetables - Tomatoes",        "description": "Diced tomatoes, crushed tomatoes, tomato paste",           "display_order": 92},
    {"name": "Canned Vegetables - Mixed",           "description": "Mixed canned vegetables",                                  "display_order": 93},
    {"name": "Canned Vegetables - Other",           "description": "Other canned vegetables not listed above",                 "display_order": 94},
    # --- Sauces & Condiments ---
    {"name": "Pasta / Tomato Sauce",                "description": "Marinara, tomato sauce, meat sauce, pasta sauce (jarred)", "display_order": 100},
    {"name": "Cooking Sauces",                      "description": "Stir-fry sauces, curry sauces, soy sauce, hot sauce",     "display_order": 101},
    {"name": "Condiments",                          "description": "Ketchup, mustard, mayo, relish, salad dressing",           "display_order": 102},
    {"name": "Sauces / Condiments - Other",         "description": "Other sauces or condiments not listed above",             "display_order": 103},
    # --- Spreads ---
    {"name": "Peanut Butter",                       "description": "Peanut butter, almond butter, other nut butters",          "display_order": 110},
    {"name": "Jam / Jelly",                         "description": "Jam, jelly, marmalade, fruit spread",                     "display_order": 111},
    {"name": "Other Spreads",                       "description": "Honey, maple syrup, hazelnut spread",                      "display_order": 112},
    # --- Fresh Produce ---
    {"name": "Fresh Produce - Root Vegetables",     "description": "Carrots, potatoes, turnips, beets, sweet potatoes",       "display_order": 120},
    {"name": "Fresh Produce - Leafy Greens",        "description": "Lettuce, spinach, kale, cabbage",                         "display_order": 121},
    {"name": "Fresh Produce - Other Vegetables",    "description": "Broccoli, cauliflower, peppers, onions, zucchini, cucumber","display_order": 122},
    {"name": "Fresh Produce - Citrus",              "description": "Oranges, lemons, limes, grapefruits",                     "display_order": 123},
    {"name": "Fresh Produce - Berries",             "description": "Strawberries, blueberries, raspberries",                  "display_order": 124},
    {"name": "Fresh Produce - Other Fruit",         "description": "Apples, bananas, grapes, peaches, pears, melons",         "display_order": 125},
    # --- Frozen ---
    {"name": "Frozen Vegetables",                   "description": "Frozen peas, corn, broccoli, spinach, mixed veg",         "display_order": 130},
    {"name": "Frozen Fruit",                        "description": "Frozen berries, mango, peaches, mixed fruit",             "display_order": 131},
    {"name": "Frozen Meals",                        "description": "Frozen entrees, dinners, pizza, burritos",                "display_order": 132},
    {"name": "Frozen Meat - Chicken / Poultry",     "description": "Frozen chicken breasts, nuggets, ground poultry",        "display_order": 133},
    {"name": "Frozen Meat - Beef / Pork",           "description": "Frozen burger patties, ground beef, frozen pork",        "display_order": 134},
    {"name": "Frozen Meat - Fish / Seafood",        "description": "Frozen fish fillets, fish sticks, frozen shrimp",        "display_order": 135},
    {"name": "Frozen Desserts",                     "description": "Ice cream, frozen yogurt, popsicles",                    "display_order": 136},
    {"name": "Frozen - Other",                      "description": "Other frozen items not listed above",                    "display_order": 137},
    # --- Dairy & Eggs ---
    {"name": "Milk - Fresh",                        "description": "Refrigerated dairy milk (2%, whole, skim)",              "display_order": 140},
    {"name": "Milk - Shelf-Stable",                 "description": "UHT/long-life milk, evaporated milk, powdered milk",     "display_order": 141},
    {"name": "Cheese",                              "description": "All cheese varieties — sliced, block, shredded",        "display_order": 142},
    {"name": "Yogurt",                              "description": "Yogurt cups, Greek yogurt, drinkable yogurt",            "display_order": 143},
    {"name": "Eggs",                                "description": "Fresh chicken eggs",                                     "display_order": 144},
    {"name": "Butter / Margarine",                  "description": "Butter, margarine, lard",                               "display_order": 145},
    {"name": "Dairy - Other",                       "description": "Other dairy products not listed above",                 "display_order": 146},
    # --- Non-Dairy ---
    {"name": "Non-Dairy Milk",                      "description": "Soy milk, oat milk, almond milk, rice milk",            "display_order": 150},
    # --- Beverages ---
    {"name": "Juice",                               "description": "Apple, orange, grape, cranberry and other fruit juices","display_order": 160},
    {"name": "Water",                               "description": "Bottled water, sparkling water",                        "display_order": 161},
    {"name": "Coffee / Tea",                        "description": "Ground coffee, instant coffee, tea bags, herbal tea",   "display_order": 162},
    {"name": "Beverages - Other",                   "description": "Sports drinks, energy drinks, other beverages",         "display_order": 163},
    # --- Snacks ---
    {"name": "Chips / Crisps",                      "description": "Potato chips, tortilla chips, popcorn, pretzels",      "display_order": 170},
    {"name": "Cookies / Biscuits",                  "description": "Cookies, digestive biscuits, sweet crackers",          "display_order": 171},
    {"name": "Granola Bars / Energy Bars",          "description": "Granola bars, cereal bars, protein bars",              "display_order": 172},
    {"name": "Nuts / Seeds / Trail Mix",            "description": "Mixed nuts, trail mix, pumpkin seeds, sunflower seeds","display_order": 173},
    {"name": "Snacks - Other",                      "description": "Other snack items not listed above",                   "display_order": 174},
    # --- Baby & Infant ---
    {"name": "Baby Formula",                        "description": "Infant formula, toddler formula",                       "display_order": 180},
    {"name": "Baby Food",                           "description": "Pureed baby food, baby snacks, baby cereals",           "display_order": 181},
    {"name": "Baby - Other",                        "description": "Diapers, wipes, or other baby items",                  "display_order": 182},
    # --- Personal Care ---
    {"name": "Soap / Body Wash",                    "description": "Bar soap, liquid soap, hand wash, body wash",          "display_order": 190},
    {"name": "Dental Care",                         "description": "Toothpaste, toothbrushes, mouthwash, floss",           "display_order": 191},
    {"name": "Feminine Hygiene",                    "description": "Pads, tampons, menstrual products",                    "display_order": 192},
    {"name": "Other Personal Care",                 "description": "Shampoo, conditioner, deodorant, razors, lotion",     "display_order": 193},
    # --- Household ---
    {"name": "Cleaning Products",                   "description": "All-purpose cleaner, bleach, disinfectant spray",     "display_order": 200},
    {"name": "Laundry / Dish Soap",                 "description": "Laundry detergent, dish soap, fabric softener",       "display_order": 201},
    {"name": "Household - Other",                   "description": "Paper towels, garbage bags, or other household items","display_order": 202},
    # --- Other ---
    {"name": "Other",                               "description": "Items that do not fit other categories",               "display_order": 999},
]

# Keywords used to match Open Food Facts category strings → our category names.
# Keys must exactly match names in FOODBANK_CATEGORIES above.
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Canned Soup - Chicken / Meat": [
        "chicken soups", "chicken noodles", "beef soups", "meat soups",
        "chicken broths", "beef broths", "chicken stews", "beef stews",
        "chicken and vegetables soup"
    ],
    "Canned Soup - Vegetable": [
        "vegetable soups", "minestrone", "mixed vegetable soup",
    ],
    "Canned Soup - Tomato": ["tomato soups", "cream of tomato soups", "dehydrated tomato soup"],
    "Canned Soup - Cream / Bisque": [
        "cream of mushroom soups", "cream of chicken", "bisque", "cream soups",
    ],
    "Canned Soup - Bean / Lentil": [
        "lentil soups", "bean soups", "split pea soup", "pea soup", 
    ],
    "Canned Soup - Other": [],
    "Canned Fish": [
        "canned tunas", "canned salmons", "sardines", "mackerels",
        "canned fishes", "tunas in brine", "salmon in",
    ],
    "Canned Meat": [
        "canned chickens", "canned meats", "spam", "corned beef", "luncheon meats",
    ],
    "Canned Beans": [
        "canned beans", "black beans", "kidney beans", "chickpeas", "pinto beans",
        "baked beans", "beans in brine", "beans in tomato", "canned common beans"
    ],
    "Canned Protein - Other": [],
    "Meat - Ground Beef": [
        "ground beef meats", "beef mince", "minced beef", "ground beef steaks",
    ],
    "Meat - Beef (Cuts / Roast)": [
        "beef steaks", "roast beef", "brisket", "ribeye", "sirloin",
        "beef roast", "beef cuts",
    ],
    "Meat - Ground Pork": [
        "ground pork meats", "pork mince", "minced pork",
    ],
    "Meat - Pork (Chops / Roast)": [
        "pork chops", "pork roast", "pork tenderloin", "pork loin",
    ],
    "Meat - Bacon / Ham": [
        "bacon", "ham", "prosciutto", "pancetta", "cold cuts", "deli meat",
    ],
    "Meat - Sausage": [
        "sausages", "bratwurst", "chorizos", "kielbasa", "breakfast sausages",
    ],
    "Meat - Chicken (Whole / Pieces)": [
        "chicken breasts", "chicken thighs", "chicken wings",
        "whole chickens", "rotisserie chickens", "chicken drumsticks",
    ],
    "Meat - Ground Poultry": [
        "ground chickens", "ground turkeys",
    ],
    "Meat - Turkey": [
        "turkey breasts", "whole turkey", "turkey roasts",
    ],
    "Meat - Fish / Seafood": [
        "salmon fillet", "tilapia", "shrimps", "seafoods", "fish fillet",
        "cod fillet", "haddock",
    ],
    "Meat - Other": [],
    "Pasta - Long": [
        "spaghetti", "linguine", "fettuccine", "angel hair", "vermicelli",
    ],
    "Pasta - Short": [
        "penne", "rotini", "fusilli", "rigatoni", "farfalle", "macaroni",
    ],
    "Pasta - Mac & Cheese Kit": [
        "macaroni and cheese", "mac and cheese", "kraft dinner", "mac & cheese",
    ],
    "Noodles - Instant / Asian": [
        "ramen", "instant noodles", "dehydrated asian-style soup with noodles", "chow mein noodles", "udon",
    ],
    "Pasta - Other": [],
    "Rice - White": [
        "white rice", "jasmine rice", "basmati rice", "long grain rice",
        "instant rice",
    ],
    "Rice - Brown / Whole Grain": ["brown rice", "wild rice", "whole grain rice"],
    "Other Grains": ["quinoa", "barley", "couscous", "bulgur", "farro"],
    "Dried Beans / Lentils": [
        "dried lentils", "dried beans", "dried peas", "dried chickpeas",
    ],
    "Grains - Other": [],
    "Cereal - Ready to Eat": [
        "breakfast cereals", "cornflakes", "corn flakes", "oat rings",
        "puffed rice", "granola cereal", "corn pops", "rice krispies",
    ],
    "Cereal - Hot / Oatmeal": [
        "oatmeals", "rolled oats", "instant oats", "cream of wheat",
        "hot cereal", "porridge",
    ],
    "Bread": ["breads", "sliced bread", "buns", "rolls", "tortillas", "wraps"],
    "Crackers": ["crackers", "rice cakes", "crispbreads", "water crackers"],
    "Flour / Baking Supplies": [
        "flours", "baking powder", "baking mix", "pancake mix", "cake mix",
    ],
    "Baked Goods - Other": [],
    "Canned Vegetables - Corn": ["canned corn", "corn kernels", "sweet corn"],
    "Canned Vegetables - Peas": ["canned peas", "canned green beans"],
    "Canned Vegetables - Tomatoes": [
        "diced tomatoes", "crushed tomatoes", "tomato paste", "whole tomatoes",
    ],
    "Canned Vegetables - Mixed": ["mixed vegetables", "canned vegetables"],
    "Canned Vegetables - Other": [],
    "Pasta / Tomato Sauce": [
        "pasta sauces", "marinara", "tomato sauces", "bolognese", "arrabiata sauces", "sauces pesto"
    ],
    "Cooking Sauces": [
        "stir fry sauce", "curry sauces", "soy sauces", "hot sauces",
        "hoisin", "teriyaki",
    ],
    "Condiments": [
        "ketchup", "mustards", "mayonnaises", "mayo", "relish", "condiments"
        "salad dressings", "vinegars", "worcestershire",
    ],
    "Sauces / Condiments - Other": [],
    "Peanut Butter": ["peanut butters", "almond butters", "nut butters"],
    "Jam / Jelly": ["jams", "jelly", "berry jams", "fruit spread", "fruit and vegetable preserves"],
    "Other Spreads": ["honeys", "maple syrups", "hazelnut spreads", "chocolate spreads", "cocoa and hazelnuts spreads", "pâtes à tartiner au chocolat"],
    "Fresh Produce - Root Vegetables": [
        "carrots", "potatoes", "turnips", "beets", "sweet potatoes",
        "radish", "parsnip",
    ],
    "Fresh Produce - Leafy Greens": [
        "lettuce", "spinach", "kale", "cabbage", "arugula",
        "chard", "collard greens",
    ],
    "Fresh Produce - Other Vegetables": [
        "broccoli", "cauliflower", "bell pepper", "onions", "zucchini",
        "cucumber", "celery", "peppers",
    ],
    "Fresh Produce - Citrus": [
        "oranges", "lemons", "limes", "grapefruits", "tangerines", "clementines",
    ],
    "Fresh Produce - Berries": [
        "strawberries", "blueberries", "raspberries", "blackberries", "cranberries",
    ],
    "Fresh Produce - Other Fruit": [
        "apples", "bananas", "grapes", "peaches", "pears", "mangoes",
        "melons", "pineapple",
    ],
    "Frozen Vegetables": [
        "frozen vegetables", "frozen peas", "frozen corn",
        "frozen broccoli", "frozen spinach", "frozen mixed veg",
    ],
    "Frozen Fruit": ["frozen berries", "frozen mango", "frozen fruit"],
    "Frozen Meals": [
        "frozen pizza", "frozen dinner", "frozen meal", "frozen entree", "frozen burrito",
    ],
    "Frozen Meat - Chicken / Poultry": [
        "frozen chicken", "chicken nuggets", "frozen turkey", "frozen poultry",
        "frozen ground chicken", "frozen ground turkey",
    ],
    "Frozen Meat - Beef / Pork": [
        "frozen burger", "frozen beef", "frozen ground beef",
        "frozen pork", "frozen meatballs",
    ],
    "Frozen Meat - Fish / Seafood": [
        "fish sticks", "frozen fish", "frozen shrimp", "frozen seafood",
        "frozen fish fillet",
    ],
    "Frozen Desserts": ["ice cream", "frozen yogurt", "popsicle", "gelato", "sherbet"],
    "Frozen - Other": [],
    "Milk - Fresh": ["whole milk", "2% milk", "skim milk", "fresh milk", "dairy milks"],
    "Milk - Shelf-Stable": [
        "uht milk", "long life milk", "evaporated milk",
        "powdered milk", "dry milk",
    ],
    "Cheese": [
        "cheddar", "mozzarella", "parmesan", "cheese slices",
        "cream cheeses", "cottage cheeses",
    ],
    "Yogurt": ["yogurt", "greek yogurt", "yoghurt"],
    "Eggs": ["eggs", "egg carton"],
    "Butter / Margarine": ["butter", "margarine", "lard"],
    "Dairy - Other": [],
    "Non-Dairy Milk": [
        "soy milk", "oat milk", "almond milk", "rice milk", "coconut milk beverage",
    ],
    "Juice": [
        "apple juices", "orange juices", "grape juices", "cranberry juices",
        "fruit juices", "fruit-based beverages",
    ],
    "Water": ["water", "sparkling water", "mineral water"],
    "Coffee / Tea": [
        "coffees", "instant coffees", "tea bags", "herbal teas", "ground coffees",
    ],
    "Beverages - Other": [],
    "Chips / Crisps": [
        "potato chips", "crisps", "tortilla chips", "popcorn", "pretzels",
    ],
    "Cookies / Biscuits": [
        "cookies", "biscuits", "digestive", "shortbread", "wafers",
    ],
    "Granola Bars / Energy Bars": [
        "granola bars", "energy bars", "cereal bars", "protein bars", "barres protéinées"
    ],
    "Nuts / Seeds / Trail Mix": [
        "mixed nuts", "trail mix", "pumpkin seeds", "sunflower seeds",
        "almonds", "walnuts", "cashews",
    ],
    "Snacks - Other": [],
    "Baby Formula": ["infant formula", "baby formula", "toddler formula"],
    "Baby Food": ["baby food", "baby cereal", "baby snacks"],
    "Baby - Other": [],
    "Soap / Body Wash": ["soap", "body wash", "hand soap", "bar soap"],
    "Dental Care": ["toothpaste", "toothbrush", "mouthwash", "dental floss"],
    "Feminine Hygiene": ["pads", "tampons", "menstrual"],
    "Other Personal Care": ["shampoo", "conditioner", "deodorant", "razors", "lotion"],
    "Cleaning Products": ["cleaner", "bleach", "disinfectant", "spray cleaner"],
    "Laundry / Dish Soap": [
        "laundry detergent", "dish soap", "dishwasher", "fabric softener",
        "washing powder",
    ],
    "Household - Other": [],
    "Other": [],
}

# Pre-build reverse lookup: keyword → category name (for fast matching)
_KEYWORD_TO_CATEGORY: dict[str, str] = {}
for _cat, _kws in CATEGORY_KEYWORDS.items():
    for _kw in _kws:
        _KEYWORD_TO_CATEGORY[_kw] = _cat


def match_off_to_category(off_categories: str, available_categories: list[str] | None = None) -> str | None:
    """
    Try to match a raw Open Food Facts categories string to one of our foodbank categories.

    Returns the matched category name, or None if no match is found.
    Pass available_categories (list of names from DB) to restrict matching to active categories.
    """
    if not off_categories:
        return None

    text = off_categories.lower()

    for keyword, category in _KEYWORD_TO_CATEGORY.items():
        if keyword in text:
            # Only return if this category is in the available set (or no filter provided)
            if available_categories is None or category in available_categories:
                return category

    return None
