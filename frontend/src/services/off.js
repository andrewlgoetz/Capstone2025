// OpenFoodFacts API helper
// Docs: https://world.openfoodfacts.org/data
// Example: https://world.openfoodfacts.org/api/v2/product/737628064502.json

import axios from 'axios'

const BASE_URL = 'https://world.openfoodfacts.org/api/v2'

export async function fetchProductByBarcode(barcode) {
  if (!barcode) throw new Error('No barcode provided')

  const fields = [
    'code',
    'product_name',
    'brands',
    'quantity',
    'categories',
    'image_front_small_url',
    'image_small_url',
    'nutriscore_grade',
    'nova_group',
    'nutriments',
    'serving_size',
  ].join(',')

  const url = `${BASE_URL}/product/${encodeURIComponent(barcode)}.json`
  const { data } = await axios.get(url, { params: { fields } })

  // v2: { product, status: 1|0, code }
  if (!data || data.status !== 1) {
    const err = new Error('Product not found')
    err.code = 'NOT_FOUND'
    err.payload = data
    throw err
  }
  return data.product
}
