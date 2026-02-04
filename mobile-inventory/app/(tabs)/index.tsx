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
  Platform,
  Image
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker';

// !!! REPLACE WITH YOUR COMPUTER'S IP ADDRESS !!!
const API_URL = 'http://xxx:8000'; 

// --- OpenFoodFacts API Helper ---
const fetchOFFProduct = async (barcode: string) => {
  try {
    const response = await axios.get(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
      {
        params: {
          fields: 'product_name,categories,brands,image_front_small_url'
        },
        timeout: 5000 // 5 second timeout
      }
    );

    if (response.data && response.data.status === 1) {
      return response.data.product;
    }
    return null;
  } catch (error) {
    console.log("OFF Fetch Error (silent fail):", error);
    return null;
  }
};

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
  quantity: string;
  unit: string;
  expirationDate: Date | null;
  locationId: string;
  imageUrl?: string | null;
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

  // form state for new items
  const [showNewItemForm, setShowNewItemForm] = useState<boolean>(false);
  const [newItemData, setNewItemData] = useState<NewItemFormData>({
    barcode: '',
    name: '',
    category: '',
    quantity: '1',
    unit: 'pcs',
    expirationDate: null,
    locationId: '1',
    imageUrl: null,
  });
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

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

  const anyModalOpen = showNewItemForm || showKnownItemForm || showScanOutForm;

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
          // --- NEW ITEM FOUND ---

          // 1. Initialize with backend suggestions or defaults
          let autoName = candidate_info?.name || '';
          let autoCategory = candidate_info?.category || '';
          let autoImage = null;

          // 2. Try to fetch data from OpenFoodFacts
          // This runs while the loading spinner is still active
          const offProduct = await fetchOFFProduct(result.data);

          if (offProduct) {
            // Combine Brand + Product Name for a better description
            if (offProduct.product_name) {
              autoName = offProduct.product_name;
              if (offProduct.brands) {
                autoName = `${offProduct.brands} ${autoName}`;
              }
            }

            // Take the first category from the comma-separated list
            if (offProduct.categories) {
              const cats = offProduct.categories.split(',');
              autoCategory = cats[0]?.trim() || autoCategory;
            }

            // Get the image URL
            if (offProduct.image_front_small_url) {
              autoImage = offProduct.image_front_small_url;
            }
          }

          // 3. Populate form data
          setNewItemData({
            barcode: candidate_info?.barcode || result.data,
            name: autoName,
            category: autoCategory,
            quantity: '1',
            unit: 'pcs',
            expirationDate: null,
            locationId: '1',
            imageUrl: autoImage,
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
        quantity: parseInt(newItemData.quantity),
        unit: newItemData.unit,
        expiration_date: newItemData.expirationDate ? newItemData.expirationDate.toISOString().split('T')[0] : null,
        location_id: parseInt(newItemData.locationId),
      };

      await axios.post(`${API_URL}/inventory/add`, payload);
      Alert.alert("Success", `Added ${newItemData.name} to inventory`);
      setShowNewItemForm(false);
      setNewItemData({
        barcode: '',
        name: '',
        category: '',
        quantity: '1',
        unit: 'pcs',
        expirationDate: null,
        locationId: '1',
        imageUrl: null,
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

      Alert.alert("Success", `Added ${quantity} unit(s) of ${knownItemData.item?.name}`);
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

            {/* IMAGE PREVIEW (If available) */}
            {newItemData.imageUrl && (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: newItemData.imageUrl }}
                  style={styles.imagePreview}
                  resizeMode="contain"
                />
                 <Text style={styles.imageLabel}>Image from OpenFoodFacts</Text>
              </View>
            )}

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
              <TextInput
                style={styles.input}
                placeholder="e.g., Food, Clothing, Hygiene"
                value={newItemData.category}
                onChangeText={(text) => setNewItemData({ ...newItemData, category: text })}
                placeholderTextColor="#999"
              />
            </View>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 60
  },
  cameraContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#222'
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    paddingHorizontal: 20
  },
  btn: {
    padding: 15,
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    flex: 1,
    alignItems: 'center'
  },
  activeBtn: {
    backgroundColor: '#999'
  },
  btnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: "center"
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  footer: {
    color: '#666',
    textAlign: 'center',
    paddingBottom: 30
  },

  // Modal styles for new item form
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  closeBtn: {
    fontSize: 24,
    color: '#999',
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#eee'
  },
  imagePreview: {
    width: 120,
    height: 120,
    marginBottom: 8
  },
  imageLabel: {
    fontSize: 12,
    color: '#999'
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#f9f9f9',
  },
  readOnlyInput: {
    backgroundColor: '#f0f0f0',
    color: '#999',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 40,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#ddd',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#4f46e5',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },

  // Centered modal styles
  centeredModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  quickFormContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 350,
  },
  quickFormTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 6,
  },
  quickFormSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
});