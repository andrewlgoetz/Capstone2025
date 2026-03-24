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
import { getFavorites, addFavorite, FavoriteItem } from '../../utils/favorites';
import api, { API_URL } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { styles } from './_index.styles';

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
  customUnit: string;
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
  const { user, userLocations, hasPermission, logout, loading: authLoading } = useAuth();
  const canScanIn = hasPermission('barcode:scan_in');
  const canScanOut = hasPermission('barcode:scan_out');

  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'in' | 'out'>('in');
  const [loading, setLoading] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [categories, setCategories] = useState<string[]>([]);

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
    categoryNotes: '',
    quantity: '1',
    unit: 'units',
    customUnit: '',
    expirationDate: null,
    locationId: defaultLocationId,
  });
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState<boolean>(false);
  const [categorySearch, setCategorySearch] = useState<string>('');
  const [showUnitPicker, setShowUnitPicker] = useState<boolean>(false);
  const [unitSearch, setUnitSearch] = useState<string>('');

  const UNIT_OPTIONS = ['units','kg','g','lbs','oz','cups','ml','L','packs','boxes','bags','bottles','cans','cartons','blocks','pieces','dozen','trays','rolls','sachets','CUSTOM'];

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

  // Fetch categories once auth is ready
  useEffect(() => {
    if (authLoading) return;
    const fetchCategories = async () => {
      try {
        const response = await api.get(`/categories/`);
        const activeCategories = response.data
          .filter((cat: any) => cat.is_active)
          .map((cat: any) => cat.name);
        setCategories(activeCategories);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
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
  }, [authLoading]);

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
            categoryNotes: '',
            quantity: '1',
            unit: 'units',
            customUnit: '',
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

    if (userLocations.length > 1 && !newItemData.locationId) {
      Alert.alert("Error", "Please select a location");
      return;
    }

    try {
      setLoading(true);
      const unitToSend = newItemData.unit === 'CUSTOM' ? (newItemData.customUnit || null) : newItemData.unit;
      const payload = {
        barcode: newItemData.barcode,
        name: newItemData.name,
        category: newItemData.category,
        category_notes: (newItemData.category === 'Other' && newItemData.categoryNotes) ? newItemData.categoryNotes : null,
        quantity: parseInt(newItemData.quantity),
        unit: unitToSend,
        expiration_date: newItemData.expirationDate ? newItemData.expirationDate.toISOString().split('T')[0] : null,
        location_id: parseInt(newItemData.locationId) || null,
      };

      const response = await api.post('/inventory/add', payload);
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
        unit: 'units',
        customUnit: '',
        expirationDate: null,
        locationId: defaultLocationId,
      });
    } catch (error: any) {
      console.log('Full error object:', error);
      console.log('Error response:', error.response);
      console.log('Error message:', error.message);

      let errorMessage = "Could not add item to inventory";

      if (error.code === 'ECONNABORTED') {
        errorMessage = "Request timeout. The item may have been added - please check your inventory before trying again.";
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert("Error", errorMessage);
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
    const addedItem = knownItemData.item;

    try {
      setLoading(true);
      await api.post(url, data);

      // Success - offer to add to favorites
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
      // Check if it's a max limit error
      const isMaxLimitError = error.message && error.message.includes('maximum');
      const title = isMaxLimitError ? "Quick Items Full" : "Oops!";
      Alert.alert(title, error.message || "Failed to add favorite");
    }
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
              <TouchableOpacity
                style={styles.categoryInput}
                onPress={() => setShowUnitPicker(true)}
              >
                <Text style={[
                  styles.categoryInputText,
                  !newItemData.unit && styles.placeholderText
                ]}>
                  {newItemData.unit || 'Select a unit...'}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Custom Unit (shown only when "CUSTOM" is selected) */}
            {newItemData.unit === 'CUSTOM' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Custom Unit</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., bundles, jars, tins..."
                  value={newItemData.customUnit}
                  onChangeText={(text) => setNewItemData({ ...newItemData, customUnit: text })}
                  placeholderTextColor="#999"
                />
              </View>
            )}

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
              onRequestClose={() => { setShowCategoryPicker(false); setCategorySearch(''); }}
            >
              <View style={styles.categoryPickerModal}>
                <TouchableOpacity
                  style={styles.categoryPickerBackdrop}
                  activeOpacity={1}
                  onPress={() => { setShowCategoryPicker(false); setCategorySearch(''); }}
                />
                <View style={styles.categoryPickerContent}>
                  <View style={styles.categoryPickerHeader}>
                    <Text style={styles.categoryPickerTitle}>Select Category</Text>
                    <TouchableOpacity onPress={() => { setShowCategoryPicker(false); setCategorySearch(''); }}>
                      <Text style={styles.categoryPickerClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.pickerSearchInput}
                    placeholder="Search categories..."
                    placeholderTextColor="#999"
                    value={categorySearch}
                    onChangeText={setCategorySearch}
                    autoFocus
                  />
                  <ScrollView style={styles.categoryPickerScroll} keyboardShouldPersistTaps="handled">
                    {categories
                      .filter(cat => cat.toLowerCase().includes(categorySearch.toLowerCase()))
                      .map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.categoryPickerOption,
                            newItemData.category === cat && styles.categoryPickerOptionActive
                          ]}
                          onPress={() => {
                            setNewItemData({ ...newItemData, category: cat });
                            setShowCategoryPicker(false);
                            setCategorySearch('');
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

            {/* Unit Picker Modal */}
            <Modal
              transparent
              animationType="slide"
              visible={showUnitPicker}
              onRequestClose={() => { setShowUnitPicker(false); setUnitSearch(''); }}
            >
              <View style={styles.categoryPickerModal}>
                <TouchableOpacity
                  style={styles.categoryPickerBackdrop}
                  activeOpacity={1}
                  onPress={() => { setShowUnitPicker(false); setUnitSearch(''); }}
                />
                <View style={styles.categoryPickerContent}>
                  <View style={styles.categoryPickerHeader}>
                    <Text style={styles.categoryPickerTitle}>Select Unit</Text>
                    <TouchableOpacity onPress={() => { setShowUnitPicker(false); setUnitSearch(''); }}>
                      <Text style={styles.categoryPickerClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.pickerSearchInput}
                    placeholder="Search units..."
                    placeholderTextColor="#999"
                    value={unitSearch}
                    onChangeText={setUnitSearch}
                    autoFocus
                  />
                  <ScrollView style={styles.categoryPickerScroll} keyboardShouldPersistTaps="handled">
                    {UNIT_OPTIONS
                      .filter(unit => unit.toLowerCase().includes(unitSearch.toLowerCase()))
                      .map((unit) => (
                        <TouchableOpacity
                          key={unit}
                          style={[
                            styles.categoryPickerOption,
                            newItemData.unit === unit && styles.categoryPickerOptionActive
                          ]}
                          onPress={() => {
                            setNewItemData({ ...newItemData, unit: unit });
                            setShowUnitPicker(false);
                            setUnitSearch('');
                          }}
                        >
                          <Text style={[
                            styles.categoryPickerOptionText,
                            newItemData.unit === unit && styles.categoryPickerOptionTextActive
                          ]}>
                            {unit}
                          </Text>
                          {newItemData.unit === unit && (
                            <Text style={styles.categoryPickerCheck}>✓</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>

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

