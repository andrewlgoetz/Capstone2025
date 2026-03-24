import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../../contexts/AuthContext';
import { searchInventoryItems, completeCheckout, scanOutLookup } from '../../services/api';

const PATRON_TYPES = ['Undergraduate', 'Graduate', 'Faculty', 'Staff', 'Community', 'Other'];

interface CartItem {
  item_id: number;
  name: string;
  quantity: number;
  available_quantity: number;
  location_id: number | null;
}

interface SearchResult {
  item_id: number;
  name: string;
  quantity: number;
  category: string;
  location_id: number | null;
}

export default function CheckoutScreen() {
  const { userLocations } = useAuth();

  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    userLocations?.length === 1 ? userLocations[0].location_id : null
  );
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showPatronTypePicker, setShowPatronTypePicker] = useState(false);

  const [patronId, setPatronId] = useState('');
  const [patronType, setPatronType] = useState('');
  const [patronIdError, setPatronIdError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [scannerActive, setScannerActive] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const lastScannedRef = useRef<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchInventoryItems(
          searchQuery,
          selectedLocationId ?? undefined
        );
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, selectedLocationId]);

  const addToCart = (item: SearchResult, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item_id === item.item_id);
      if (existing) {
        return prev.map((c) =>
          c.item_id === item.item_id
            ? { ...c, quantity: Math.min(c.available_quantity, c.quantity + qty) }
            : c
        );
      }
      return [
        ...prev,
        {
          item_id: item.item_id,
          name: item.name,
          quantity: qty,
          available_quantity: item.quantity,
          location_id: item.location_id ?? selectedLocationId,
        },
      ];
    });
    setSearchQuery('');
    setSearchResults([]);
    showToast(`${item.name} added to cart`);
  };

  const increaseQty = (item_id: number) => {
    setCart((prev) =>
      prev.map((c) =>
        c.item_id === item_id
          ? { ...c, quantity: Math.min(c.available_quantity, c.quantity + 1) }
          : c
      )
    );
  };

  const decreaseQty = (item_id: number) => {
    setCart((prev) =>
      prev.map((c) =>
        c.item_id === item_id ? { ...c, quantity: Math.max(1, c.quantity - 1) } : c
      )
    );
  };

  const removeFromCart = (item_id: number) => {
    setCart((prev) => prev.filter((c) => c.item_id !== item_id));
  };

  const handleBarcodeScan = async (barcode: string) => {
    if (lastScannedRef.current === barcode) return;
    lastScannedRef.current = barcode;
    setTimeout(() => { lastScannedRef.current = null; }, 2000);

    try {
      const result = await scanOutLookup(barcode);
      if (result.status === 'FOUND' && result.item) {
        addToCart(result.item as any);
        setScannerActive(false);
      } else {
        showToast('Item not found in inventory', 'warning');
        setScannerActive(false);
      }
    } catch {
      showToast('Barcode lookup failed', 'error');
      setScannerActive(false);
    }
  };

  const handleToggleScanner = async () => {
    if (scannerActive) {
      setScannerActive(false);
      return;
    }
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        showToast('Camera permission is required to scan', 'error');
        return;
      }
    }
    setScannerActive(true);
  };

  const handleCompleteCheckout = async () => {
    if (!patronId.trim()) {
      setPatronIdError('Patron ID is required');
      showToast('Please enter a Patron ID', 'warning');
      return;
    }
    if (cart.length === 0) {
      showToast('Add at least one item to checkout', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await completeCheckout({
        patron_id: patronId.trim(),
        patron_type: patronType || null,
        items: cart.map((c) => ({
          item_id: c.item_id,
          location_id: c.location_id,
          quantity: c.quantity,
        })),
      });
      const checkedOutCount = cart.reduce((sum, c) => sum + c.quantity, 0);
      const checkedOutPatron = patronId.trim();
      setCart([]);
      setPatronId('');
      setPatronType('');
      setPatronIdError('');
      Alert.alert(
        'Checkout Complete',
        `Successfully checked out ${checkedOutCount} item${checkedOutCount !== 1 ? 's' : ''} for patron ${checkedOutPatron}.`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Checkout failed. Please try again.';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalQuantity = cart.reduce((sum, c) => sum + c.quantity, 0);
  const selectedLocation = userLocations?.find((l) => l.location_id === selectedLocationId);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Checkout</Text>
        <Text style={styles.headerSubtitle}>Scan or search items, add them to the cart, and complete checkout all at once.</Text>

        {/* Location Picker */}
        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowLocationPicker(true)}>
          <Text style={styles.pickerButtonText}>
            📍 {selectedLocation?.name ?? 'All Locations'}
          </Text>
          <Text style={styles.pickerChevron}>▼</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Patron Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patron Info</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Patron ID <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, patronIdError ? styles.inputError : null]}
              value={patronId}
              onChangeText={(v) => { setPatronId(v); if (v.trim()) setPatronIdError(''); }}
              placeholder="Enter patron ID"
              placeholderTextColor="#666"
            />
            {!!patronIdError && <Text style={styles.errorText}>{patronIdError}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Patron Type</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowPatronTypePicker(true)}>
              <Text style={patronType ? styles.inputText : styles.inputPlaceholder}>
                {patronType || 'Select patron type...'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Scanner */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Items</Text>

          <TouchableOpacity
            style={[styles.scanButton, scannerActive && styles.scanButtonActive]}
            onPress={handleToggleScanner}
          >
            <Text style={styles.scanButtonText}>
              {scannerActive ? '✕  Stop Scanner' : '📷  Scan Barcode'}
            </Text>
          </TouchableOpacity>

          {scannerActive && (
            <View style={styles.cameraContainer}>
              <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={({ data }) => handleBarcodeScan(data)}
              />
            </View>
          )}

          {/* Search */}
          <TextInput
            style={styles.input}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by item name..."
            placeholderTextColor="#666"
          />

          {isSearching && (
            <ActivityIndicator color="#4f46e5" style={{ marginTop: 8 }} />
          )}

          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map((item) => (
                <TouchableOpacity
                  key={item.item_id}
                  style={styles.searchResultRow}
                  onPress={() => addToCart(item)}
                >
                  <View>
                    <Text style={styles.searchResultName}>{item.name}</Text>
                    <Text style={styles.searchResultSub}>{item.category} · Available: {item.quantity}</Text>
                  </View>
                  <Text style={styles.addButtonText}>+ Add</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Cart */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cart</Text>
            {cart.length > 0 && (
              <Text style={styles.cartCount}>{cart.length} {cart.length === 1 ? 'item' : 'items'}</Text>
            )}
          </View>

          {cart.length === 0 ? (
            <View style={styles.emptyCart}>
              <Text style={styles.emptyCartText}>No items added yet.</Text>
            </View>
          ) : (
            cart.map((item) => (
              <View key={item.item_id} style={styles.cartRow}>
                <View style={styles.cartItemInfo}>
                  <Text style={styles.cartItemName}>{item.name}</Text>
                  <Text style={styles.cartItemSub}>Available: {item.available_quantity}</Text>
                </View>
                <View style={styles.cartControls}>
                  <TouchableOpacity style={styles.qtyButton} onPress={() => decreaseQty(item.item_id)}>
                    <Text style={styles.qtyButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyButton} onPress={() => increaseQty(item.item_id)}>
                    <Text style={styles.qtyButtonText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeButton} onPress={() => removeFromCart(item.item_id)}>
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Complete Checkout */}
        {cart.length > 0 && (
          <View style={styles.checkoutFooter}>
            <Text style={styles.totalText}>Total: {totalQuantity} units</Text>
            <TouchableOpacity
              style={[styles.checkoutButton, isSubmitting && styles.checkoutButtonDisabled]}
              onPress={handleCompleteCheckout}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.checkoutButtonText}>Complete Checkout</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Location Picker Modal */}
      <Modal visible={showLocationPicker} transparent animationType="fade" onRequestClose={() => setShowLocationPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Location</Text>
            <ScrollView>
              <TouchableOpacity
                style={[styles.modalOption, selectedLocationId === null && styles.modalOptionActive]}
                onPress={() => { setSelectedLocationId(null); setShowLocationPicker(false); }}
              >
                <Text style={[styles.modalOptionText, selectedLocationId === null && styles.modalOptionTextActive]}>
                  All Locations
                </Text>
                {selectedLocationId === null && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>
              {userLocations?.map((loc) => (
                <TouchableOpacity
                  key={loc.location_id}
                  style={[styles.modalOption, selectedLocationId === loc.location_id && styles.modalOptionActive]}
                  onPress={() => { setSelectedLocationId(loc.location_id); setShowLocationPicker(false); }}
                >
                  <Text style={[styles.modalOptionText, selectedLocationId === loc.location_id && styles.modalOptionTextActive]}>
                    {loc.name}
                  </Text>
                  {selectedLocationId === loc.location_id && <Text style={styles.checkMark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Patron Type Picker Modal */}
      <Modal visible={showPatronTypePicker} transparent animationType="fade" onRequestClose={() => setShowPatronTypePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Patron Type</Text>
            <ScrollView>
              {PATRON_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.modalOption, patronType === type && styles.modalOptionActive]}
                  onPress={() => { setPatronType(type); setShowPatronTypePicker(false); }}
                >
                  <Text style={[styles.modalOptionText, patronType === type && styles.modalOptionTextActive]}>
                    {type}
                  </Text>
                  {patronType === type && <Text style={styles.checkMark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Toast */}
      {toast && (
        <View style={[styles.toast, styles[`toast_${toast.type}`]]}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
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
    gap: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 4,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  pickerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  pickerChevron: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  cartCount: {
    fontSize: 13,
    color: '#a0a0c0',
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#a0a0c0',
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#3a3a3c',
    justifyContent: 'center',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputText: {
    color: '#fff',
    fontSize: 15,
  },
  inputPlaceholder: {
    color: '#666',
    fontSize: 15,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 2,
  },
  scanButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  scanButtonActive: {
    backgroundColor: '#dc2626',
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  cameraContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    height: 220,
  },
  camera: {
    flex: 1,
  },
  searchResults: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3c',
  },
  searchResultName: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 15,
  },
  searchResultSub: {
    color: '#a0a0c0',
    fontSize: 12,
    marginTop: 2,
  },
  addButtonText: {
    color: '#4f46e5',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyCart: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyCartText: {
    color: '#666',
    fontSize: 14,
  },
  cartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    padding: 12,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 15,
  },
  cartItemSub: {
    color: '#a0a0c0',
    fontSize: 12,
    marginTop: 2,
  },
  cartControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#3a3a3c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 20,
  },
  qtyValue: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    minWidth: 24,
    textAlign: 'center',
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#EF4444',
    fontSize: 13,
  },
  checkoutFooter: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  totalText: {
    color: '#a0a0c0',
    fontSize: 14,
    textAlign: 'right',
  },
  checkoutButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  checkoutButtonDisabled: {
    opacity: 0.6,
  },
  checkoutButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  modalOptionActive: {
    backgroundColor: 'rgba(79,70,229,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  modalOptionText: {
    color: '#fff',
    fontSize: 15,
  },
  modalOptionTextActive: {
    color: '#818cf8',
    fontWeight: '600',
  },
  checkMark: {
    color: '#818cf8',
    fontSize: 16,
    fontWeight: '700',
  },
  // Toast
  toast: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  toast_success: {
    backgroundColor: '#10B981',
  },
  toast_error: {
    backgroundColor: '#EF4444',
  },
  toast_warning: {
    backgroundColor: '#F59E0B',
  },
  toastText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
