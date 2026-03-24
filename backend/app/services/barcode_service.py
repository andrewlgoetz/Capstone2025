from app.db.session import SessionLocal
import requests


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def lookup_barcode(barcode: str):
    """
    Look up a barcode in Open Food Facts.

    Returns a dict with product info, or None if not found.
    `off_categories` is the raw OFF categories string — callers are responsible
    for mapping it to a local category (see category_mappings.match_off_to_category).
    """
    try:
        fields = [
            'code', 'product_name', 'brands', 'quantity', 'categories',
            'image_front_small_url', 'image_small_url'
        ]

        url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
        headers = {'User-Agent': 'HamFoodBank-InventoryApp/1.0 (contact@hamfoodbank.ca)'}
        response = requests.get(url, params={'fields': ','.join(fields)}, headers=headers, timeout=5)
        data = response.json()

        if data and data.get('status') == 1 and data.get('product'):
            product = data['product']
            print(f"[OFF] name={product.get('product_name')} | categories={product.get('categories')}")
            return {
                'name': product.get('product_name', 'Unknown Product'),
                'off_categories': product.get('categories', ''),  # raw — caller maps to local category
                'barcode': barcode,
                'brand': product.get('brands'),
                'image_url': product.get('image_front_small_url'),
            }
    except Exception as e:
        print(f"[lookup_barcode] Error: {e}")

    return None
