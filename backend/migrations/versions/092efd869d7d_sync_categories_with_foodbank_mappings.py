"""sync_categories_with_foodbank_mappings

Revision ID: 092efd869d7d
Revises: 9132f445a044
Create Date: 2026-03-23 21:12:45.491775

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '092efd869d7d'
down_revision: Union[str, Sequence[str], None] = '9132f445a044'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# The 81 granular categories from category_mappings.py
FOODBANK_CATEGORIES = [
    {"name": "Canned Soup - Chicken / Meat",       "description": "Chicken noodle, beef stew, meat-based canned soups",           "display_order": 10},
    {"name": "Canned Soup - Vegetable",             "description": "Minestrone, vegetable medley canned soups",                   "display_order": 11},
    {"name": "Canned Soup - Tomato",                "description": "Tomato, tomato basil canned soups",                           "display_order": 12},
    {"name": "Canned Soup - Cream / Bisque",        "description": "Cream of mushroom, cream of chicken, bisque",                "display_order": 13},
    {"name": "Canned Soup - Bean / Lentil",         "description": "Lentil, split pea, bean canned soups",                       "display_order": 14},
    {"name": "Canned Soup - Other",                 "description": "Canned soups not listed above",                              "display_order": 15},
    {"name": "Canned Fish",                         "description": "Tuna, salmon, sardines, mackerel in cans",                   "display_order": 20},
    {"name": "Canned Meat",                         "description": "Canned chicken, Spam, corned beef, other canned meats",      "display_order": 21},
    {"name": "Canned Beans",                        "description": "Black beans, kidney beans, chickpeas, baked beans (canned)", "display_order": 22},
    {"name": "Canned Protein - Other",              "description": "Other canned protein not listed above",                      "display_order": 23},
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
    {"name": "Pasta - Long",                        "description": "Spaghetti, linguine, fettuccine",                           "display_order": 50},
    {"name": "Pasta - Short",                       "description": "Penne, rotini, fusilli, macaroni",                          "display_order": 51},
    {"name": "Pasta - Mac & Cheese Kit",            "description": "Boxed mac and cheese, Kraft Dinner",                        "display_order": 52},
    {"name": "Noodles - Instant / Asian",           "description": "Instant ramen, rice noodles, chow mein noodles",            "display_order": 53},
    {"name": "Pasta - Other",                       "description": "Pasta or noodles not listed above",                         "display_order": 54},
    {"name": "Rice - White",                        "description": "White rice, jasmine rice, basmati rice",                    "display_order": 60},
    {"name": "Rice - Brown / Whole Grain",          "description": "Brown rice, wild rice",                                     "display_order": 61},
    {"name": "Other Grains",                        "description": "Quinoa, barley, couscous, bulgur",                          "display_order": 62},
    {"name": "Dried Beans / Lentils",               "description": "Dried lentils, split peas, dried chickpeas, dried beans",   "display_order": 63},
    {"name": "Grains - Other",                      "description": "Grains or dried goods not listed above",                    "display_order": 64},
    {"name": "Cereal - Ready to Eat",               "description": "Cold cereal, cornflakes, oat rings, granola cereal",        "display_order": 70},
    {"name": "Cereal - Hot / Oatmeal",              "description": "Oats, cream of wheat, porridge, instant oatmeal",          "display_order": 71},
    {"name": "Bread",                               "description": "Sliced bread, buns, rolls, wraps, tortillas",              "display_order": 80},
    {"name": "Crackers",                            "description": "Crackers, rice cakes, crispbreads",                         "display_order": 81},
    {"name": "Flour / Baking Supplies",             "description": "Flour, baking powder, baking soda, sugar, baking mixes",   "display_order": 82},
    {"name": "Baked Goods - Other",                 "description": "Muffins, pastries, cakes, or other baked items",           "display_order": 83},
    {"name": "Canned Vegetables - Corn",            "description": "Canned or jarred corn",                                     "display_order": 90},
    {"name": "Canned Vegetables - Peas",            "description": "Canned peas, canned green beans",                          "display_order": 91},
    {"name": "Canned Vegetables - Tomatoes",        "description": "Diced tomatoes, crushed tomatoes, tomato paste",           "display_order": 92},
    {"name": "Canned Vegetables - Mixed",           "description": "Mixed canned vegetables",                                  "display_order": 93},
    {"name": "Canned Vegetables - Other",           "description": "Other canned vegetables not listed above",                 "display_order": 94},
    {"name": "Pasta / Tomato Sauce",                "description": "Marinara, tomato sauce, meat sauce, pasta sauce (jarred)", "display_order": 100},
    {"name": "Cooking Sauces",                      "description": "Stir-fry sauces, curry sauces, soy sauce, hot sauce",     "display_order": 101},
    {"name": "Condiments",                          "description": "Ketchup, mustard, mayo, relish, salad dressing",           "display_order": 102},
    {"name": "Sauces / Condiments - Other",         "description": "Other sauces or condiments not listed above",             "display_order": 103},
    {"name": "Peanut Butter",                       "description": "Peanut butter, almond butter, other nut butters",          "display_order": 110},
    {"name": "Jam / Jelly",                         "description": "Jam, jelly, marmalade, fruit spread",                     "display_order": 111},
    {"name": "Other Spreads",                       "description": "Honey, maple syrup, hazelnut spread",                     "display_order": 112},
    {"name": "Fresh Produce - Root Vegetables",     "description": "Carrots, potatoes, turnips, beets, sweet potatoes",       "display_order": 120},
    {"name": "Fresh Produce - Leafy Greens",        "description": "Lettuce, spinach, kale, cabbage",                         "display_order": 121},
    {"name": "Fresh Produce - Other Vegetables",    "description": "Broccoli, cauliflower, peppers, onions, zucchini, cucumber","display_order": 122},
    {"name": "Fresh Produce - Citrus",              "description": "Oranges, lemons, limes, grapefruits",                     "display_order": 123},
    {"name": "Fresh Produce - Berries",             "description": "Strawberries, blueberries, raspberries",                  "display_order": 124},
    {"name": "Fresh Produce - Other Fruit",         "description": "Apples, bananas, grapes, peaches, pears, melons",         "display_order": 125},
    {"name": "Frozen Vegetables",                   "description": "Frozen peas, corn, broccoli, spinach, mixed veg",         "display_order": 130},
    {"name": "Frozen Fruit",                        "description": "Frozen berries, mango, peaches, mixed fruit",             "display_order": 131},
    {"name": "Frozen Meals",                        "description": "Frozen entrees, dinners, pizza, burritos",                "display_order": 132},
    {"name": "Frozen Meat - Chicken / Poultry",     "description": "Frozen chicken breasts, nuggets, ground poultry",        "display_order": 133},
    {"name": "Frozen Meat - Beef / Pork",           "description": "Frozen burger patties, ground beef, frozen pork",        "display_order": 134},
    {"name": "Frozen Meat - Fish / Seafood",        "description": "Frozen fish fillets, fish sticks, frozen shrimp",        "display_order": 135},
    {"name": "Frozen Desserts",                     "description": "Ice cream, frozen yogurt, popsicles",                    "display_order": 136},
    {"name": "Frozen - Other",                      "description": "Other frozen items not listed above",                    "display_order": 137},
    {"name": "Milk - Fresh",                        "description": "Refrigerated dairy milk (2%, whole, skim)",              "display_order": 140},
    {"name": "Milk - Shelf-Stable",                 "description": "UHT/long-life milk, evaporated milk, powdered milk",     "display_order": 141},
    {"name": "Cheese",                              "description": "All cheese varieties - sliced, block, shredded",        "display_order": 142},
    {"name": "Yogurt",                              "description": "Yogurt cups, Greek yogurt, drinkable yogurt",            "display_order": 143},
    {"name": "Eggs",                                "description": "Fresh chicken eggs",                                     "display_order": 144},
    {"name": "Butter / Margarine",                  "description": "Butter, margarine, lard",                               "display_order": 145},
    {"name": "Dairy - Other",                       "description": "Other dairy products not listed above",                 "display_order": 146},
    {"name": "Non-Dairy Milk",                      "description": "Soy milk, oat milk, almond milk, rice milk",            "display_order": 150},
    {"name": "Juice",                               "description": "Apple, orange, grape, cranberry and other fruit juices","display_order": 160},
    {"name": "Water",                               "description": "Bottled water, sparkling water",                        "display_order": 161},
    {"name": "Coffee / Tea",                        "description": "Ground coffee, instant coffee, tea bags, herbal tea",   "display_order": 162},
    {"name": "Beverages - Other",                   "description": "Sports drinks, energy drinks, other beverages",         "display_order": 163},
    {"name": "Chips / Crisps",                      "description": "Potato chips, tortilla chips, popcorn, pretzels",      "display_order": 170},
    {"name": "Cookies / Biscuits",                  "description": "Cookies, digestive biscuits, sweet crackers",          "display_order": 171},
    {"name": "Granola Bars / Energy Bars",          "description": "Granola bars, cereal bars, protein bars",              "display_order": 172},
    {"name": "Nuts / Seeds / Trail Mix",            "description": "Mixed nuts, trail mix, pumpkin seeds, sunflower seeds","display_order": 173},
    {"name": "Snacks - Other",                      "description": "Other snack items not listed above",                   "display_order": 174},
    {"name": "Baby Formula",                        "description": "Infant formula, toddler formula",                       "display_order": 180},
    {"name": "Baby Food",                           "description": "Pureed baby food, baby snacks, baby cereals",           "display_order": 181},
    {"name": "Baby - Other",                        "description": "Diapers, wipes, or other baby items",                  "display_order": 182},
    {"name": "Soap / Body Wash",                    "description": "Bar soap, liquid soap, hand wash, body wash",          "display_order": 190},
    {"name": "Dental Care",                         "description": "Toothpaste, toothbrushes, mouthwash, floss",           "display_order": 191},
    {"name": "Feminine Hygiene",                    "description": "Pads, tampons, menstrual products",                    "display_order": 192},
    {"name": "Other Personal Care",                 "description": "Shampoo, conditioner, deodorant, razors, lotion",     "display_order": 193},
    {"name": "Cleaning Products",                   "description": "All-purpose cleaner, bleach, disinfectant spray",     "display_order": 200},
    {"name": "Laundry / Dish Soap",                 "description": "Laundry detergent, dish soap, fabric softener",       "display_order": 201},
    {"name": "Household - Other",                   "description": "Paper towels, garbage bags, or other household items","display_order": 202},
    {"name": "Other",                               "description": "Items that do not fit other categories",               "display_order": 999},
]

# The original 11 broad categories (for downgrade)
ORIGINAL_CATEGORIES = [
    "Canned Goods",
    "Dry Goods",
    "Fresh Produce",
    "Frozen Foods",
    "Dairy",
    "Beverages",
    "Snacks",
    "Baby Products",
    "Personal Care",
    "Household",
    "Other",
]


def upgrade() -> None:
    conn = op.get_bind()

    new_names = [c["name"] for c in FOODBANK_CATEGORIES]

    # Deactivate any categories not in the new list
    conn.execute(
        sa.text(
            "UPDATE categories SET is_active = false "
            "WHERE name != ALL(:names)"
        ),
        {"names": new_names},
    )

    # Upsert all new categories
    for cat in FOODBANK_CATEGORIES:
        conn.execute(
            sa.text(
                "INSERT INTO categories (name, description, display_order, is_active) "
                "VALUES (:name, :description, :display_order, true) "
                "ON CONFLICT (name) DO UPDATE SET "
                "  is_active = true, "
                "  description = EXCLUDED.description, "
                "  display_order = EXCLUDED.display_order"
            ),
            {
                "name": cat["name"],
                "description": cat["description"],
                "display_order": cat["display_order"],
            },
        )


def downgrade() -> None:
    conn = op.get_bind()

    # Reactivate the original broad categories (if they exist)
    conn.execute(
        sa.text(
            "UPDATE categories SET is_active = true "
            "WHERE name = ANY(:names)"
        ),
        {"names": ORIGINAL_CATEGORIES},
    )

    # Deactivate all granular categories
    new_names = [c["name"] for c in FOODBANK_CATEGORIES]
    conn.execute(
        sa.text(
            "UPDATE categories SET is_active = false "
            "WHERE name = ANY(:names)"
        ),
        {"names": new_names},
    )
