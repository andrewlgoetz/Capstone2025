import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getFavorites, removeFavorite, FavoriteItem } from '../../utils/favorites';
import api, { API_URL } from '../../services/api';

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<FavoriteItem | null>(null);
  const [quantity, setQuantity] = useState<string>('1');
  const [actionType, setActionType] = useState<'add' | 'remove'>('add');
  const [currentQuantity, setCurrentQuantity] = useState<number>(0);
  const [fetchingQuantity, setFetchingQuantity] = useState<boolean>(false);

  const loadFavorites = async () => {
    try {
      const favs = await getFavorites();
      setFavorites(favs);
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  };

  // Reload favorites whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [])
  );

  const handleItemPress = async (item: FavoriteItem) => {
    setSelectedItem(item);
    setQuantity('1');
    setShowAddModal(true);

    // Fetch current quantity from backend
    try {
      setFetchingQuantity(true);
      const response = await api.get(`/inventory/${item.item_id}`);
      setCurrentQuantity(response.data.quantity || 0);
    } catch (error) {
      console.error('Failed to fetch current quantity:', error);
      setCurrentQuantity(0);
    } finally {
      setFetchingQuantity(false);
    }
  };

  const handleAddToInventory = async () => {
    if (!selectedItem) return;

    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    try {
      setLoading(true);
      await api.post(`/barcode/${selectedItem.item_id}/increase`, {
        amount: qty,
      });

      Alert.alert(
        'Success',
        `Added ${qty} ${selectedItem.unit || 'units'} of ${selectedItem.name} to inventory`
      );

      setShowAddModal(false);
      setSelectedItem(null);
      setQuantity('1');
      setActionType('add');
      setCurrentQuantity(0);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to add item to inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromInventory = async () => {
    if (!selectedItem) return;

    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    // Check if trying to remove more than available
    if (qty > currentQuantity) {
      Alert.alert(
        'Insufficient Quantity',
        `Cannot remove ${qty} ${selectedItem.unit || 'units'}. Only ${currentQuantity} ${selectedItem.unit || 'units'} available in inventory.`
      );
      return;
    }

    try {
      setLoading(true);
      await api.post(`/barcode/scan-out/${selectedItem.item_id}/confirm`, {
        quantity: qty,
      });

      Alert.alert(
        'Success',
        `Removed ${qty} ${selectedItem.unit || 'units'} of ${selectedItem.name} from inventory`
      );

      setShowAddModal(false);
      setSelectedItem(null);
      setQuantity('1');
      setActionType('add');
      setCurrentQuantity(0);
    } catch (error: any) {
      console.error(error);
      const errorMsg = error?.response?.data?.detail || 'Failed to remove item from inventory';
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (actionType === 'add') {
      handleAddToInventory();
    } else {
      handleRemoveFromInventory();
    }
  };

  const handleRemoveItem = (item: FavoriteItem) => {
    Alert.alert(
      'Remove from Quick Items?',
      `Are you sure you want to remove "${item.name}" from your quick items?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFavorite(item.item_id);
              await loadFavorites();
              Alert.alert('Removed', `${item.name} has been removed from Quick Items`);
            } catch (error) {
              Alert.alert('Error', 'Failed to remove item');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: FavoriteItem }) => (
    <View style={styles.itemCard}>
      <TouchableOpacity
        style={styles.itemContent}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemDetails}>
            {item.category} • {item.unit}
          </Text>
        </View>
        <Text style={styles.addIcon}>+</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleRemoveItem(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.deleteButtonText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>⭐</Text>
      <Text style={styles.emptyTitle}>No Quick Items Yet</Text>
      <Text style={styles.emptyText}>
        Add items to Quick Items after scanning to access them quickly here
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quick Items</Text>
        <Text style={styles.headerSubtitle}>
          {favorites.length} of 10 items
        </Text>
      </View>

      <FlatList
        data={favorites}
        renderItem={renderItem}
        keyExtractor={(item) => item.item_id.toString()}
        contentContainerStyle={favorites.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmpty}
      />

      {/* Quick Inventory Action Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
                  <Text style={styles.modalTitle}>
                    {actionType === 'add' ? 'Add to Inventory' : 'Remove from Inventory'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedItem?.name}
                  </Text>
                  <Text style={styles.modalDetails}>
                    {selectedItem?.category} • {selectedItem?.unit}
                  </Text>
                  <View style={styles.quantityBadge}>
                    <Text style={styles.quantityLabel}>Current Stock:</Text>
                    <Text style={styles.quantityValue}>
                      {fetchingQuantity ? 'Loading...' : `${currentQuantity} ${selectedItem?.unit || 'units'}`}
                    </Text>
                  </View>

                  {/* Action Type Toggle */}
                  <View style={styles.actionToggle}>
                    <TouchableOpacity
                      style={[styles.toggleButton, actionType === 'add' && styles.toggleButtonActive]}
                      onPress={() => setActionType('add')}
                    >
                      <Text style={[styles.toggleButtonText, actionType === 'add' && styles.toggleButtonTextActive]}>
                        Add
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleButton, actionType === 'remove' && styles.toggleButtonActive]}
                      onPress={() => setActionType('remove')}
                    >
                      <Text style={[styles.toggleButtonText, actionType === 'remove' && styles.toggleButtonTextActive]}>
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Quantity</Text>
                    <TextInput
                      style={styles.input}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="number-pad"
                      placeholder="1"
                      placeholderTextColor="#999"
                      autoFocus
                    />
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setShowAddModal(false);
                        setQuantity('1');
                        setActionType('add');
                        setCurrentQuantity(0);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.addButton, actionType === 'remove' && styles.removeButton]}
                      onPress={handleSubmit}
                      disabled={loading}
                    >
                      <Text style={styles.addButtonText}>
                        {loading
                          ? (actionType === 'add' ? 'Adding...' : 'Removing...')
                          : (actionType === 'add' ? 'Add' : 'Remove')
                        }
                      </Text>
                    </TouchableOpacity>
                  </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    backgroundColor: '#4f46e5',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
  },
  itemCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 14,
    color: '#888',
  },
  addIcon: {
    fontSize: 32,
    color: '#4f46e5',
    fontWeight: '300',
    marginLeft: 12,
  },
  deleteButton: {
    padding: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4f46e5',
    marginBottom: 4,
  },
  modalDetails: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  quantityBadge: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3C3C3E',
  },
  quantityLabel: {
    fontSize: 13,
    color: '#fff',
    marginBottom: 4,
  },
  quantityValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    backgroundColor: '#111',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    flex: 1,
    backgroundColor: '#4f46e5',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  actionToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#333',
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
  },
  toggleButtonActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#2C2C3E',
  },
  toggleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
  },
  toggleButtonTextActive: {
    color: '#4f46e5',
  },
  removeButton: {
    backgroundColor: '#ef4444',
  },
});
