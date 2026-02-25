// Barcode lookup helper (backend fetches from OpenFoodFacts)
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export async function fetchProductByBarcode(barcode) {
  if (!barcode) throw new Error('No barcode provided')

  try {
    const url = `${API_BASE_URL}/barcode/${encodeURIComponent(barcode)}`
    const { data } = await axios.get(url)

    // Backend returns: { name, category (mapped), barcode, brand, image_url }
    if (!data) {
      const err = new Error('Product not found')
      err.code = 'NOT_FOUND'
      throw err
    }

    return data
  } catch (error) {
    if (error.response?.status === 404) {
      const err = new Error('Product not found')
      err.code = 'NOT_FOUND'
      throw err
    }
    throw error
  }
}
