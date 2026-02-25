import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Button,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getFavorites, addFavorite, FavoriteItem } from '../../utils/favorites';
import { styles } from './_index.styles';

// !!! REPLACE WITH YOUR COMPUTER'S IP ADDRESS !!!
const API_URL = 'http://192.168.1.154:8000';

interface InventoryItem {
  item_id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  expiration_date?: string;
  location_id: number;
  barcode: string;
}

interface NewItemFormData {
  barcode: string;
  name: string;
  category: string;
  categoryNotes: string;
  quantity: string;
  unit: string;
  expirationDate: Date | null;
  locationId: string;
}

interface KnownItemFormData {
  item: InventoryItem | null;
  quantity: string;
}

interface ScanOutFormData {
  item: InventoryItem | null;
  quantity: string;
}

interface ScanInResponse {
  status: 'KNOWN' | 'NEW';
  item?: InventoryItem;
  candidate_info?: {
    barcode: string;
    name: string;
    category: string;
  };
}

interface ScanOutResponse {
  status: 'FOUND' | 'NOT_FOUND';
  item?: InventoryItem;
}

export default function App(): React.ReactElement {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'in' | 'out'>('in');
  const [loading, setLoading] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [categories, setCategories] = useState<string[]>([]);

  // form state for new items
  const [showNewItemForm, setShowNewItemForm] = useState<boolean>(false);
  const [newItemData, setNewItemData] = useState<NewItemFormData>({
    barcode: '',
    name: '',
    category: '',
    categoryNotes: '',
    quantity: '1',
    unit: 'pcs',
    expirationDate: null,
    locationId: '1',
  });
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState<boolean>(false);

  // form state for known items (quantity)
  const [showKnownItemForm, setShowKnownItemForm] = useState<boolean>(false);
  const [knownItemData, setKnownItemData] = useState<KnownItemFormData>({
    item: null,
    quantity: '1',
  });

  // form state for scan out (quantity)
  const [showScanOutForm, setShowScanOutForm] = useState<boolean>(false);
  const [scanOutData, setScanOutData] = useState<ScanOutFormData>({
    item: null,
    quantity: '1',
  });

  // favorites state
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const anyModalOpen = showNewItemForm || showKnownItemForm || showScanOutForm;

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(`${API_URL}/categories/`);
        const activeCategories = response.data
          .filter((cat: any) => cat.is_active)
          .map((cat: any) => cat.name);
        setCategories(activeCategories);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        // Fallback to default categories if fetch fails
        setCategories([
          "Canned & Packaged",
          "Fresh Produce",
          "Dairy & Eggs",
          "Proteins & Meat",
          "Grains & Pasta",
          "Condiments & Oils",
          "Beverages",
          "Other"
        ]);
      }
    };
    fetchCategories();
  }, []);

  // Load favorites on mount
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const favs = await getFavorites();
        setFavorites(favs);
      } catch (error) {
        console.error('Failed to load favorites:', error);
      }
    };
    loadFavorites();
  }, []);

  useEffect(() => {
    let scanTimeout: ReturnType<typeof setTimeout> | null = null;

    if (isScanning) {
      scanTimeout = setTimeout(() => {
        setIsScanning(false);
        Alert.alert(
          "Scan Timeout",
          "Unable to detect barcode. Please try again.",
          [{ text: "OK", onPress: () => {} }]
        );
      }, 7000);
    }

    return () => {
      if (scanTimeout) clearTimeout(scanTimeout);
    };
  }, [isScanning]);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{color: 'white', marginBottom: 20}}>We need camera permission</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  const handleBarCodeScanned = async (result: BarcodeScanningResult): Promise<void> => {
    if (loading) return;
    setIsScanning(false); 
    setLoading(true);
    
    const payload = { barcode: result.data };

    try {
      if (mode === 'in') {
        // --- SCAN IN LOGIC ---
        const response = await axios.post<ScanInResponse>(`${API_URL}/barcode/scan-in`, payload);
        const { status, item, candidate_info } = response.data;

        if (status === 'KNOWN' && item) {
          // item exists - show form to enter quantity
          setKnownItemData({ item, quantity: '1' });
          setShowKnownItemForm(true);
        } else if (status === 'NEW') {
          // new item - show form to create it
          setNewItemData({
            barcode: candidate_info?.barcode || result.data,
            name: candidate_info?.name || '',
            category: candidate_info?.category || '',
            categoryNotes: '',
            quantity: '1',
            unit: 'pcs',
            expirationDate: null,
            locationId: '1',
          });
          setShowNewItemForm(true);
        } else {
          Alert.alert("Error", "Unknown response from server");
        }
      } else {
        // --- SCAN OUT LOGIC ---
        const response = await axios.post<ScanOutResponse>(`${API_URL}/barcode/scan-out`, payload);
        const { status, item } = response.data;

        if (status === 'FOUND' && item) {
          // show form to enter quantity to remove
          setScanOutData({ item, quantity: '1' });
          setShowScanOutForm(true);
        } else {
          Alert.alert("Error", "Item not found in inventory.");
        }
      }
    } catch (error) {
      console.log(error);
      Alert.alert("Connection Error", `Could not connect to ${API_URL}.\nEnsure backend is running and IP is correct.`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewItem = async (): Promise<void> => {
    if (!newItemData.name.trim()) {
      Alert.alert("Error", "Item name is required");
      return;
    }

    if (!newItemData.quantity || parseInt(newItemData.quantity) <= 0) {
      Alert.alert("Error", "Quantity must be greater than 0");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        barcode: newItemData.barcode,
        name: newItemData.name,
        category: newItemData.category,
        category_notes: (newItemData.category === 'Other' && newItemData.categoryNotes) ? newItemData.categoryNotes : null,
        quantity: parseInt(newItemData.quantity),
        unit: newItemData.unit,
        expiration_date: newItemData.expirationDate ? newItemData.expirationDate.toISOString().split('T')[0] : null,
        location_id: parseInt(newItemData.locationId),
      };

      const response = await axios.post(`${API_URL}/inventory/add`, payload);
      const createdItem = response.data;

      // Success - offer to add to favorites
      Alert.alert(
        "Success",
        `Added ${newItemData.name} to inventory`,
        [
          {
            text: "Add to Quick Items ⭐",
            onPress: () => {
              const favoriteItem: InventoryItem = {
                item_id: createdItem.item_id,
                name: createdItem.name,
                category: createdItem.category,
                unit: createdItem.unit,
                barcode: createdItem.barcode,
                quantity: createdItem.quantity,
                expiration_date: createdItem.expiration_date,
                location_id: createdItem.location_id,
              };
              handleAddToFavorites(favoriteItem);
            }
          },
          {
            text: "Done",
            style: "default"
          }
        ]
      );

      setShowNewItemForm(false);
      setNewItemData({
        barcode: '',
        name: '',
        category: '',
        categoryNotes: '',
        quantity: '1',
        unit: 'pcs',
        expirationDate: null,
        locationId: '1',
      });
    } catch (error: any) {
      console.log(error);
      Alert.alert("Error", error.response?.data?.detail || "Could not add item to inventory");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmKnownItem = async (): Promise<void> => {
    if (!knownItemData.quantity || parseInt(knownItemData.quantity) <= 0) {
      Alert.alert("Error", "Quantity must be greater than 0");
      return;
    }

    try {
      setLoading(true);
      const quantity = parseInt(knownItemData.quantity);
      
      await axios.post(
        `${API_URL}/barcode/${knownItemData.item?.item_id}/increase`,
        { amount: quantity }
      );

      // Success - offer to add to favorites
      const addedItem = knownItemData.item;
      Alert.alert(
        "Success",
        `Added ${quantity} unit(s) of ${addedItem?.name}`,
        [
          {
            text: "Add to Quick Items ⭐",
            onPress: () => {
              if (addedItem) handleAddToFavorites(addedItem);
            }
          },
          {
            text: "Done",
            style: "default"
          }
        ]
      );

      setShowKnownItemForm(false);
      setKnownItemData({ item: null, quantity: '1' });
    } catch (error: any) {
      console.log(error);
      Alert.alert("Error", error.response?.data?.detail || "Could not update inventory");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmScanOut = async (): Promise<void> => {
    if (!scanOutData.quantity || parseInt(scanOutData.quantity) <= 0) {
      Alert.alert("Error", "Quantity must be greater than 0");
      return;
    }

    if (scanOutData.item && parseInt(scanOutData.quantity) > scanOutData.item.quantity) {
      Alert.alert("Error", `Cannot remove more than available quantity (${scanOutData.item.quantity})`);
      return;
    }

    try {
      setLoading(true);
      const quantity = parseInt(scanOutData.quantity);

      await axios.post(
        `${API_URL}/barcode/scan-out/${scanOutData.item?.item_id}/confirm`,
        { quantity }
      );

      Alert.alert("Success", `Removed ${quantity} unit(s) of ${scanOutData.item?.name}`);
      setShowScanOutForm(false);
      setScanOutData({ item: null, quantity: '1' });
    } catch (error: any) {
      console.log(error);
      Alert.alert("Error", error.response?.data?.detail || "Could not remove item from inventory");
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date): void => {
    if (selectedDate) {
      setNewItemData({ ...newItemData, expirationDate: selectedDate });
    }
    setShowDatePicker(false);
  };

  // Handler: Add to favorites
  const handleAddToFavorites = async (item: InventoryItem): Promise<void> => {
    try {
      const favoriteItem: FavoriteItem = {
        item_id: item.item_id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        barcode: item.barcode,
      };

      const added = await addFavorite(favoriteItem);
      if (added) {
        setFavorites(await getFavorites());
        Alert.alert("Success", `${item.name} added to Quick Items`);
      } else {
        Alert.alert("Already saved", "Item is already in Quick Items");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to add favorite");
    }
  };


  return (
    <View style={styles.container}>
      {/* Header / Controls */}
      <View style={styles.controls}>
        <TouchableOpacity 
          style={[styles.btn, isScanning && mode === "in" && styles.activeBtn]} 
          onPress={() => {
            setMode("in");
            setIsScanning(true); 
          }}>
          <Text style={styles.btnText}>
            {isScanning && mode === "in" ? "🔴 Scanning..." : "Scan IN \n(Add)"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.btn, isScanning && mode === "out" && styles.activeBtn]} 
          onPress={() => {
            setMode("out");
            setIsScanning(true);  
          }}>
          <Text style={styles.btnText}>
            {isScanning && mode === "out" ? "🔴 Scanning..." : "Scan OUT \n(Remove)"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
        />
        {/* Loading Overlay */}
        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={{color:'#fff', marginTop: 10}}>Processing...</Text>
          </View>
        )}
      </View>

      <Text style={styles.footer}>Connected to: {API_URL}</Text>

      {/* ===== MODAL: NEW ITEM FORM ===== */}
      <Modal
        visible={showNewItemForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewItemForm(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <ScrollView style={styles.formContainer}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Add New Item</Text>
              <TouchableOpacity onPress={() => setShowNewItemForm(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Barcode (read-only) */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Barcode</Text>
              <TextInput
                style={[styles.input, styles.readOnlyInput]}
                value={newItemData.barcode}
                editable={false}
              />
            </View>

            {/* Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Item Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter item name"
                value={newItemData.name}
                onChangeText={(text) => setNewItemData({ ...newItemData, name: text })}
                placeholderTextColor="#999"
              />
            </View>

            {/* Category */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Category</Text>
              <TouchableOpacity
                style={styles.categoryInput}
                onPress={() => setShowCategoryPicker(true)}
              >
                <Text style={[
                  styles.categoryInputText,
                  !newItemData.category && styles.placeholderText
                ]}>
                  {newItemData.category || 'Select a category...'}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Category Notes (shown only when "Other" is selected) */}
            {newItemData.category === 'Other' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Category Notes (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Pet supplies, cleaning products..."
                  value={newItemData.categoryNotes}
                  onChangeText={(text) => setNewItemData({ ...newItemData, categoryNotes: text })}
                  placeholderTextColor="#999"
                />
                <Text style={styles.helperText}>Specify what type of item this is</Text>
              </View>
            )}

            {/* Quantity */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Quantity *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter quantity"
                value={newItemData.quantity}
                onChangeText={(text) => setNewItemData({ ...newItemData, quantity: text })}
                keyboardType="number-pad"
                placeholderTextColor="#999"
              />
            </View>

            {/* Unit */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Unit</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., pcs, kg, bottle"
                value={newItemData.unit}
                onChangeText={(text) => setNewItemData({ ...newItemData, unit: text })}
                placeholderTextColor="#999"
              />
            </View>

            {/* Expiration Date */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Expiration Date (Optional)</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {newItemData.expirationDate
                    ? newItemData.expirationDate.toLocaleDateString()
                    : 'Select Date'}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={newItemData.expirationDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )}
            </View>

            {/* Category Picker Modal */}
            <Modal
              transparent
              animationType="slide"
              visible={showCategoryPicker}
              onRequestClose={() => setShowCategoryPicker(false)}
            >
              <View style={styles.categoryPickerModal}>
                <TouchableOpacity
                  style={styles.categoryPickerBackdrop}
                  activeOpacity={1}
                  onPress={() => setShowCategoryPicker(false)}
                />
                <View style={styles.categoryPickerContent}>
                  <View style={styles.categoryPickerHeader}>
                    <Text style={styles.categoryPickerTitle}>Select Category</Text>
                    <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                      <Text style={styles.categoryPickerClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.categoryPickerScroll}>
                    {categories.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryPickerOption,
                          newItemData.category === cat && styles.categoryPickerOptionActive
                        ]}
                        onPress={() => {
                          setNewItemData({ ...newItemData, category: cat });
                          setShowCategoryPicker(false);
                        }}
                      >
                        <Text style={[
                          styles.categoryPickerOptionText,
                          newItemData.category === cat && styles.categoryPickerOptionTextActive
                        ]}>
                          {cat}
                        </Text>
                        {newItemData.category === cat && (
                          <Text style={styles.categoryPickerCheck}>✓</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>

            {/* Location ID */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Location ID</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 1"
                value={newItemData.locationId}
                onChangeText={(text) => setNewItemData({ ...newItemData, locationId: text })}
                keyboardType="number-pad"
                placeholderTextColor="#999"
              />
            </View>

            {/* Buttons */}
            <View style={styles.formButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowNewItemForm(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleAddNewItem}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>
                  {loading ? 'Adding...' : 'Add Item'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== MODAL: KNOWN ITEM QUANTITY FORM (SCAN IN) ===== */}
      <Modal
        visible={showKnownItemForm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKnownItemForm(false)}
      >
        <View style={styles.centeredModal}>
          <View style={styles.quickFormContainer}>
            <Text style={styles.quickFormTitle}>Add to {knownItemData.item?.name}</Text>
            <Text style={styles.quickFormSubtitle}>
              Current quantity: {knownItemData.item?.quantity}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Quantity to Add</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                value={knownItemData.quantity}
                onChangeText={(text) => setKnownItemData({ ...knownItemData, quantity: text })}
                keyboardType="number-pad"
                placeholderTextColor="#999"
                autoFocus
              />
            </View>

            <View style={styles.formButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowKnownItemForm(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleConfirmKnownItem}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>
                  {loading ? 'Adding...' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== MODAL: SCAN OUT QUANTITY FORM ===== */}
      <Modal
        visible={showScanOutForm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScanOutForm(false)}
      >
        <View style={styles.centeredModal}>
          <View style={styles.quickFormContainer}>
            <Text style={styles.quickFormTitle}>Remove from {scanOutData.item?.name}</Text>
            <Text style={styles.quickFormSubtitle}>
              Available quantity: {scanOutData.item?.quantity}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Quantity to Remove</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                value={scanOutData.quantity}
                onChangeText={(text) => setScanOutData({ ...scanOutData, quantity: text })}
                keyboardType="number-pad"
                placeholderTextColor="#999"
                autoFocus
              />
            </View>

            <View style={styles.formButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowScanOutForm(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleConfirmScanOut}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>
                  {loading ? 'Removing...' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

