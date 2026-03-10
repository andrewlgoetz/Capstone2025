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
import DateTimePicker from '@react-native-community/datetimepicker';
import api, { API_URL } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

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
  const { user, userLocations, hasPermission, logout } = useAuth();
  const canScanIn = hasPermission('barcode:scan_in');
  const canScanOut = hasPermission('barcode:scan_out');

  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'in' | 'out'>('in');
  const [loading, setLoading] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Default location: auto-select if user has exactly one
  const defaultLocationId = userLocations.length === 1 ? String(userLocations[0].location_id) : '';

  // Persistent scan-in location selector
  const [selectedLocationId, setSelectedLocationId] = useState<string>(defaultLocationId);
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false);

  // Keep location in sync if userLocations loads after mount
  useEffect(() => {
    if (userLocations.length === 1 && !selectedLocationId) {
      setSelectedLocationId(String(userLocations[0].location_id));
    }
  }, [userLocations, selectedLocationId]);

  const selectedLocation = userLocations.find(l => String(l.location_id) === selectedLocationId);

  // form state for new items
  const [showNewItemForm, setShowNewItemForm] = useState<boolean>(false);
  const [newItemData, setNewItemData] = useState<NewItemFormData>({
    barcode: '',
    name: '',
    category: '',
    quantity: '1',
    unit: 'pcs',
    expirationDate: null,
    locationId: defaultLocationId,
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

    if (mode === 'in' && !selectedLocationId) {
      setIsScanning(false);
      Alert.alert("No Location Selected", "Please select a location before scanning in.");
      return;
    }

    setIsScanning(false);
    setLoading(true);

    const payload = { barcode: result.data };

    try {
      if (mode === 'in') {
        const response = await api.post<ScanInResponse>('/barcode/scan-in', payload);
        const { status, item, candidate_info } = response.data;

        if (status === 'KNOWN' && item) {
          setKnownItemData({ item, quantity: '1' });
          setShowKnownItemForm(true);
        } else if (status === 'NEW') {
          setNewItemData({
            barcode: candidate_info?.barcode || result.data,
            name: candidate_info?.name || '',
            category: candidate_info?.category || '',
            quantity: '1',
            unit: 'pcs',
            expirationDate: null,
            locationId: selectedLocationId,
          });
          setShowNewItemForm(true);
        } else {
          Alert.alert("Error", "Unknown response from server");
        }
      } else {
        const response = await api.post<ScanOutResponse>('/barcode/scan-out', payload);
        const { status, item } = response.data;

        if (status === 'FOUND' && item) {
          setScanOutData({ item, quantity: '1' });
          setShowScanOutForm(true);
        } else {
          Alert.alert("Error", "Item not found in inventory.");
        }
      }
    } catch (error: any) {
      if (error?.response?.status === 401) {
        Alert.alert("Session Expired", "Please sign in again.");
        logout();
      } else {
        console.log(error);
        Alert.alert("Connection Error", `Could not connect to server.\nEnsure backend is running and IP is correct.`);
      }
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

    const payload = {
      barcode: newItemData.barcode,
      name: newItemData.name,
      category: newItemData.category,
      quantity: parseInt(newItemData.quantity),
      unit: newItemData.unit,
      expiration_date: newItemData.expirationDate ? newItemData.expirationDate.toISOString().split('T')[0] : null,
      location_id: parseInt(newItemData.locationId) || null,
    };

    try {
      setLoading(true);
      await api.post('/inventory/add', payload);
      Alert.alert("Success", `Added ${newItemData.name} to inventory`);
      setShowNewItemForm(false);
      setNewItemData({
        barcode: '',
        name: '',
        category: '',
        quantity: '1',
        unit: 'pcs',
        expirationDate: null,
        locationId: defaultLocationId,
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

    const quantity = parseInt(knownItemData.quantity);
    const url = `/barcode/${knownItemData.item?.item_id}/increase`;
    const data = { amount: quantity, location_id: parseInt(selectedLocationId) || undefined };
    const itemName = knownItemData.item?.name || 'item';

    try {
      setLoading(true);
      await api.post(url, data);
      Alert.alert("Success", `Added ${quantity} unit(s) of ${itemName}`);
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

    const quantity = parseInt(scanOutData.quantity);
    const url = `/barcode/scan-out/${scanOutData.item?.item_id}/confirm`;
    const data = { quantity };
    const itemName = scanOutData.item?.name || 'item';

    try {
      setLoading(true);
      await api.post(url, data);
      Alert.alert("Success", `Removed ${quantity} unit(s) of ${itemName}`);
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

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => logout() },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* User info bar */}
      <View style={styles.userBar}>
        <Text style={styles.userName}>{user?.name || 'User'}</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Location selector (scan-in only) */}
      {canScanIn && (
        <View style={styles.locationBar}>
          <Text style={styles.locationLabel}>Scanning to:</Text>
          <TouchableOpacity
            style={[styles.locationSelector, !selectedLocationId && styles.locationSelectorEmpty]}
            onPress={() => userLocations.length > 1 && setShowLocationPicker(true)}
            disabled={userLocations.length <= 1}
          >
            <Text style={[styles.locationSelectorText, !selectedLocationId && styles.locationSelectorTextEmpty]}>
              {selectedLocation?.name ?? 'Select location'}
            </Text>
            {userLocations.length > 1 && <Text style={styles.locationChevron}>▾</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Header / Controls */}
      <View style={styles.controls}>
        {canScanIn && (
          <TouchableOpacity
            style={[styles.btn, isScanning && mode === "in" && styles.activeBtn]}
            onPress={() => {
              setMode("in");
              setIsScanning(true);
            }}>
            <Text style={styles.btnText}>
              {isScanning && mode === "in" ? "Scanning..." : "Scan IN \n(Add)"}
            </Text>
          </TouchableOpacity>
        )}
        {canScanOut && (
          <TouchableOpacity
            style={[styles.btn, isScanning && mode === "out" && styles.activeBtn]}
            onPress={() => {
              setMode("out");
              setIsScanning(true);
            }}>
            <Text style={styles.btnText}>
              {isScanning && mode === "out" ? "Scanning..." : "Scan OUT \n(Remove)"}
            </Text>
          </TouchableOpacity>
        )}
        {!canScanIn && !canScanOut && (
          <Text style={styles.noPermText}>You don&apos;t have scanning permissions. Contact your admin.</Text>
        )}
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

            {/* Location */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Location</Text>
              {userLocations.length <= 1 ? (
                <TextInput
                  style={[styles.input, styles.readOnlyInput]}
                  value={userLocations[0]?.name || 'No location assigned'}
                  editable={false}
                />
              ) : (
                <ScrollView horizontal={false} style={styles.locationPicker}>
                  {userLocations.map((loc) => (
                    <TouchableOpacity
                      key={loc.location_id}
                      style={[
                        styles.locationOption,
                        newItemData.locationId === String(loc.location_id) && styles.locationOptionSelected,
                      ]}
                      onPress={() => setNewItemData({ ...newItemData, locationId: String(loc.location_id) })}
                    >
                      <Text style={[
                        styles.locationOptionText,
                        newItemData.locationId === String(loc.location_id) && styles.locationOptionTextSelected,
                      ]}>
                        {loc.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
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

      {/* ===== MODAL: LOCATION PICKER ===== */}
      <Modal
        visible={showLocationPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <View style={styles.centeredModal}>
          <View style={styles.quickFormContainer}>
            <Text style={styles.quickFormTitle}>Select Location</Text>
            {userLocations.map((loc) => (
              <TouchableOpacity
                key={loc.location_id}
                style={[
                  styles.locationPickerOption,
                  selectedLocationId === String(loc.location_id) && styles.locationPickerOptionSelected,
                ]}
                onPress={() => {
                  setSelectedLocationId(String(loc.location_id));
                  setShowLocationPicker(false);
                }}
              >
                <Text style={[
                  styles.locationPickerOptionText,
                  selectedLocationId === String(loc.location_id) && styles.locationPickerOptionTextSelected,
                ]}>
                  {loc.name}
                </Text>
              </TouchableOpacity>
            ))}
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
  userBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
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
  noPermText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
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
  locationPicker: {
    maxHeight: 150,
  },
  locationOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#f9f9f9',
  },
  locationOptionSelected: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  locationOptionText: {
    fontSize: 14,
    color: '#333',
  },
  locationOptionTextSelected: {
    color: '#4f46e5',
    fontWeight: '600',
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

  // Location selector bar
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 10,
  },
  locationLabel: {
    color: '#aaa',
    fontSize: 13,
    flexShrink: 0,
  },
  locationSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#4f46e5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  locationSelectorEmpty: {
    borderColor: '#ef4444',
  },
  locationSelectorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  locationSelectorTextEmpty: {
    color: '#ef4444',
  },
  locationChevron: {
    color: '#aaa',
    fontSize: 14,
    marginLeft: 6,
  },

  // Location picker modal options
  locationPickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  locationPickerOptionSelected: {
    backgroundColor: '#eef2ff',
    borderRadius: 6,
  },
  locationPickerOptionText: {
    fontSize: 15,
    color: '#333',
  },
  locationPickerOptionTextSelected: {
    color: '#4f46e5',
    fontWeight: '600',
  },

});
