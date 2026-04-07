// This test file focuses on the UI logic of the ScannerScreen component, particularly around camera permissions. It mocks the necessary dependencies to isolate the component's behavior and tests both the granted and denied permission scenarios.

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import ScannerScreen from '../app/(tabs)/index';

jest.mock('../services/api', () => ({
  getCategories: jest.fn().mockResolvedValue([]),
  getFavorites: jest.fn().mockResolvedValue([]),
  getLocations: jest.fn().mockResolvedValue([]),
}));

// Mock expo-camera
jest.mock('expo-camera', () => {
  const actualExpoCamera = jest.requireActual('expo-camera');
  return {
    ...actualExpoCamera,
    CameraView: 'CameraView',
    useCameraPermissions: jest.fn(() => [
      { granted: true, status: 'granted', canAskAgain: true },
      jest.fn(() => Promise.resolve({ granted: true })),
    ]),
  };
});

// Mock useAuth — hasPermission must be present or the component crashes on line 73
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { user_id: 1, name: 'Test User', bank_id: 1 },
    token: 'fake-jwt-token',
    login: jest.fn(),
    logout: jest.fn(),
    userLocations: [],
    hasPermission: jest.fn(() => true),
  }),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('Mobile Scanner UI Logic', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the scanner view when permissions are granted', async () => {
    const { queryByText } = render(<ScannerScreen />);

    await waitFor(() => {
      // No permission-request UI shown when camera access is granted
      expect(queryByText(/permission/i)).toBeNull();
    });
  });

  it('shows permission request if camera access is missing', async () => {
    const { useCameraPermissions } = require('expo-camera');
    (useCameraPermissions as jest.Mock).mockReturnValue([
      { granted: false, status: 'denied', canAskAgain: true },
      jest.fn(),
    ]);

    const { getAllByText } = render(<ScannerScreen />);

    // Permission request UI should be shown when camera access is denied
    await waitFor(() => {
      const permissionElements = getAllByText(/permission/i);
      expect(permissionElements.length).toBeGreaterThan(0);
    });
  });
});
