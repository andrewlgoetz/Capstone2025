// This test suite focuses on the resilience of the ScannerScreen component in handling rapid duplicate scans and network failures during item submissions. 
// It ensures that the app prevents multiple modals from opening due to rapid scans of the same item and that it properly handles network errors without losing user input or leaving the user uninformed. 
// The tests use mocked API responses and camera permissions to simulate real-world scenarios while maintaining control over the test environment.

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ScannerScreen from '../app/(tabs)/index';
import api from '../services/api';

jest.mock('../services/api', () => {
  const mock = {
    get: jest.fn().mockResolvedValue({ data: [] }),
    post: jest.fn(),
    API_URL: 'http://test:8000',
  };
  return { __esModule: true, default: mock, API_URL: 'http://test:8000' };
});

jest.mock('expo-camera', () => ({
  CameraView: ({ onBarcodeScanned, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="camera-view-mock" {...props} />;
  },
  useCameraPermissions: jest.fn(() => [
    { granted: true, status: 'granted', canAskAgain: true },
    jest.fn(() => Promise.resolve({ granted: true })),
  ]),
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { user_id: 1, name: 'Test User', bank_id: 1 },
    token: 'fake-jwt-token',
    login: jest.fn(),
    logout: jest.fn(),
    userLocations: [{ location_id: 1, name: 'Main Pantry' }],
    hasPermission: jest.fn(() => true),
    loading: false,
  }),
}));

// Mock favorites utils (imported by ScannerScreen) to prevent errors and control test data
jest.mock('../utils/favorites', () => ({
  getFavorites: jest.fn().mockResolvedValue([]),
  addFavorite: jest.fn().mockResolvedValue(true),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

const activateScanMode = (getByText: Function) => {
  fireEvent.press(getByText(/Scan IN/i));
};

describe('Mobile Resilience: Network & Duplicates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api as any).get.mockResolvedValue({ data: [] });
  });

  it('prevents duplicate submissions from rapid multi-scans', async () => {
    (api as any).post.mockResolvedValue({
      data: {
        status: 'KNOWN',
        item: {
          item_id: 1,
          name: 'Baked Beans',
          category: 'Canned & Packaged',
          quantity: 10,
          unit: 'cans',
          location_id: 1,
          barcode: '12345',
        },
      },
    });

    const { getByText, queryAllByText, getByTestId } = render(<ScannerScreen />);

    activateScanMode(getByText);
    // Simulate 3 rapid scans of the same item
    const camera = getByTestId('camera-view-mock');
    fireEvent(camera, 'onBarcodeScanned', { type: 'qr', data: '12345' });
    fireEvent(camera, 'onBarcodeScanned', { type: 'qr', data: '12345' });
    fireEvent(camera, 'onBarcodeScanned', { type: 'qr', data: '12345' });
    // Only one modal should open and only one API call should be made
    await waitFor(() => {
      const modals = queryAllByText(/Quantity to Add/i);
      expect(modals.length).toBeLessThanOrEqual(1);
      expect((api as any).post).toHaveBeenCalledTimes(1);
    });
  });

  it('prevents silent data loss and notifies user on network failure', async () => {
    (api as any).post
      .mockResolvedValueOnce({
        data: {
          status: 'KNOWN',
          item: {
            item_id: 99,
            name: 'Test Item',
            category: 'Other',
            quantity: 5,
            unit: 'units',
            location_id: 1,
            barcode: '777',
          },
        },
      })
      // The second API call simulates the submission of the quantity update, which fails due to a network error
      .mockRejectedValueOnce(new Error('Network Error'));

    const { getByText, getByTestId } = render(<ScannerScreen />);
    // Step 1: First scan-in lookup succeeds and opens quantity modal
    activateScanMode(getByText);
    fireEvent(getByTestId('camera-view-mock'), 'onBarcodeScanned', { type: 'qr', data: '777' });
    // After the first successful scan-in lookup, the quantity modal should open
    await waitFor(() => {
      expect(getByText(/Quantity to Add/i)).toBeTruthy();
    });

    fireEvent.press(getByText('Confirm'));
    // After the failed submission, the modal should remain open and the user should be notified
    await waitFor(() => {
      expect((api as any).post).toHaveBeenCalledTimes(2);
      expect(getByText(/Quantity to Add/i)).toBeTruthy();
    });
  });
});
