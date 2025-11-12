# This simulates barcode lookup.
# Later you can connect to an external product API (like OpenFoodFacts).

# must comply with BarcodeInfo Model
dummy_barcodes = {
    "0123456789123": {"name": "Canned Beans", "category": "Food", "unit": "pcs"},
    "9876543210987": {"name": "T-Shirt", "category": "Clothing", "unit": "pcs"}
}

def lookup_barcode(barcode: str):
    return dummy_barcodes.get(barcode, None)
