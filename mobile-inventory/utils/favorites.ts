import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = '@inventory_favorites';
const MAX_FAVORITES = 10;

export interface FavoriteItem {
  item_id: number;
  name: string;
  category: string;
  unit: string;
  barcode: string;
}

// Get all favorites
export const getFavorites = async (): Promise<FavoriteItem[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(FAVORITES_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error('Error loading favorites:', error);
    return [];
  }
};

// Add item to favorites
export const addFavorite = async (item: FavoriteItem): Promise<boolean> => {
  try {
    const favorites = await getFavorites();

    // Check if already favorited
    if (favorites.some(fav => fav.item_id === item.item_id)) {
      return false;
    }

    // Check max limit
    if (favorites.length >= MAX_FAVORITES) {
      throw new Error(`Maximum ${MAX_FAVORITES} favorites allowed`);
    }

    favorites.push(item);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    return true;
  } catch (error) {
    console.error('Error adding favorite:', error);
    throw error;
  }
};

// Remove item from favorites
export const removeFavorite = async (item_id: number): Promise<void> => {
  try {
    const favorites = await getFavorites();
    const filtered = favorites.filter(fav => fav.item_id !== item_id);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing favorite:', error);
    throw error;
  }
};

// Check if item is favorited
export const isFavorite = async (item_id: number): Promise<boolean> => {
  try {
    const favorites = await getFavorites();
    return favorites.some(fav => fav.item_id === item_id);
  } catch (error) {
    console.error('Error checking favorite:', error);
    return false;
  }
};

// Get max favorites count
export const getMaxFavorites = (): number => {
  return MAX_FAVORITES;
};
