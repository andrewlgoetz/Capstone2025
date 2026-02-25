from datetime import datetime, date, timedelta
from app.schemas.inventory_schema import *
from app.db.session import SessionLocal
import requests
from app.category_mappings import map_off_to_nonprofit_category

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



def lookup_barcode(barcode: str):
    try:
        fields = [
            'code', 'product_name', 'brands', 'quantity', 'categories',
            'image_front_small_url', 'image_small_url'
        ]
        
        url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
        response = requests.get(url, params={'fields': ','.join(fields)}, timeout=5)
        data = response.json()
        
        if data and data.get('status') == 1 and data.get('product'):
            product = data['product']
            return {
                'name': product.get('product_name', 'Unknown Product'),
                'category': map_off_to_nonprofit_category(product.get('categories', '')),
                'barcode': barcode,
                'brand': product.get('brands'),
                'image_url': product.get('image_front_small_url'),
            }
    except Exception as e:
        print(f"[lookup_barcode] Error: {e}")
    
    return None
