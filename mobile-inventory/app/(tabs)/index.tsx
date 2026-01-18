import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import axios from 'axios';

// !!! REPLACE WITH YOUR COMPUTER'S IP ADDRESS !!!
const API_URL = 'YOURIP:8000'; 

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [mode, setMode] = useState('in'); // 'in' or 'out'
  const [loading, setLoading] = useState(false);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{color: 'white', marginBottom: 20}}>We need camera permission</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    
    // Payload matches your backend ScanRequest schema
    const payload = { barcode: data };

    try {
      if (mode === 'in') {
        // --- SCAN IN LOGIC ---
        // Endpoint defined in backend/app/api/barcode_routes.py
        const response = await axios.post(`${API_URL}/barcode/scan-in`, payload);
        const { status, item, candidate_info } = response.data;

        if (status === 'KNOWN') {
           Alert.alert("Item Found!", `Scanned in: ${item.name}\nCurrent Qty: ${item.quantity}`);
           // Optional: You could auto-increment here if you wanted
        } else {
           const name = candidate_info?.name || "Unknown Item";
           Alert.alert("New Item", `This item is new to your database:\n${name}`);
        }

      } else {
        // --- SCAN OUT LOGIC ---
        const response = await axios.post(`${API_URL}/barcode/scan-out`, payload);
        const { status, item } = response.data;

        if (status === 'FOUND') {
          Alert.alert("Confirm Removal", `Remove 1 unit of:\n${item.name}?`, [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Remove", 
              onPress: () => confirmScanOut(item.item_id) 
            }
          ]);
        } else {
          Alert.alert("Error", "Item not found in inventory.");
        }
      }
    } catch (error) {
      console.log(error);
      Alert.alert("Connection Error", `Could not connect to ${API_URL}.\nEnsure backend is running and IP is correct.`);
    } finally {
      setLoading(false);
      // Wait 2 seconds before allowing the next scan
      setTimeout(() => setScanned(false), 2000);
    }
  };

  const confirmScanOut = async (itemId) => {
    try {
      // Endpoint: /barcode/scan-out/{item_id}/confirm
      await axios.post(`${API_URL}/barcode/scan-out/${itemId}/confirm`, { quantity: 1 });
      Alert.alert("Success", "Inventory updated!");
    } catch (error) {
      Alert.alert("Error", "Could not update quantity.");
    }
  };

  return (
    <View style={styles.container}>
      {/* Header / Controls */}
      <View style={styles.controls}>
        <TouchableOpacity 
          style={[styles.btn, mode === 'in' && styles.activeBtn]} 
          onPress={() => setMode('in')}>
          <Text style={styles.btnText}>Scan IN (Add)</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.btn, mode === 'out' && styles.activeBtn]} 
          onPress={() => setMode('out')}>
          <Text style={styles.btnText}>Scan OUT (Remove)</Text>
        </TouchableOpacity>
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  cameraContainer: { flex: 1, margin: 20, borderRadius: 20, overflow: 'hidden', backgroundColor: '#222' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 15, paddingHorizontal: 20 },
  btn: { padding: 15, backgroundColor: '#333', borderRadius: 8, flex: 1, alignItems: 'center' },
  activeBtn: { backgroundColor: '#4f46e5' }, // Matches your webapp Indigo color
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  footer: { color: '#666', textAlign: 'center', paddingBottom: 30 }
});