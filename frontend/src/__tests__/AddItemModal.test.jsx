// these tests focus on the core logic and behavior of AddItemModal, including form validation, error handling, barcode scanning, and button states. 
// They mock external dependencies to isolate the component's functionality and ensure consistent test results.
/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import AddItemModal from '../components/inventory/AddItemModal';
import * as api from '../services/api';

// ---------------------------------------------------------------------------
// Mock AuthContext so the import never returns undefined.
// ---------------------------------------------------------------------------
vi.mock('../contexts/AuthContext', () => {
  const AuthContext = React.createContext({ user: { bank_id: 1 } });
  return { AuthContext };
});

// ---------------------------------------------------------------------------
// Mock CategorySearch with a plain labelled input so it doesn't interfere
// with getByLabelText queries or bring in its own sub-dependencies.
// ---------------------------------------------------------------------------
vi.mock('../components/inventory/CategorySearch', () => ({
  default: ({ value, onChange, required, placeholder }) => (
    <input
      aria-label="Category"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
    />
  ),
}));

// ---------------------------------------------------------------------------
// Mock DietaryRestrictionIcon so ItemManagerModal isn't pulled in.
// ---------------------------------------------------------------------------
vi.mock('../components/inventory/ItemManagerModal', () => ({
  DietaryRestrictionIcon: () => null,
}));

// ---------------------------------------------------------------------------
// API and React Query mocks.
// ---------------------------------------------------------------------------
vi.mock('../services/api', () => ({
  fetchInventoryByBarcode: vi.fn(),
  getCategories: vi.fn().mockResolvedValue([]),
  getDietaryRestrictions: vi.fn().mockResolvedValue([]),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({ data: [] }),
  useMutation: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
}));

import { AuthContext } from '../contexts/AuthContext';

const renderWithAuth = (ui, options = {}) => {
  return render(
    <AuthContext.Provider value={{ user: { bank_id: 1 } }}>
      {ui}
    </AuthContext.Provider>,
    options
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Frontend UI: AddItemModal Logic & Behavior', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // --- Item Entry and Editing Forms ---

  it('enforces required fields and validates numeric quantity', async () => {
    renderWithAuth(
      <AddItemModal open={true} onClose={mockOnClose} onSave={mockOnSave} mode="add" locations={[]} />
    );

    const quantityInput = screen.getByLabelText(/Quantity/i);

    expect(quantityInput).toHaveAttribute('min', '0');
    expect(quantityInput).toHaveAttribute('type', 'number');

    await userEvent.type(quantityInput, 'not-a-number');
    expect(quantityInput).toHaveValue(null);
  });

  // --- Error Handling and User Feedback ---

  it('displays validation errors clearly without clearing valid data', async () => {
    const testLocations = [
      { location_id: 1, name: 'Main Pantry', bank_id: 1 },
      { location_id: 2, name: 'Back Storage', bank_id: 1 },
    ];

    const defaultValues = {
      item_id: 1,
      name: 'Beans',
      quantity: 50,
      location_id: 1,
      original_location_id: 1,
    };

    await act(async () => {
      renderWithAuth(
        <AddItemModal
          open={true}
          mode="edit"
          defaultValues={defaultValues}
          locations={testLocations}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );
    });

    // Decrease quantity below original (50 → 40)
    const qtyInput = screen.getByLabelText(/Quantity/i);
    await userEvent.clear(qtyInput);
    await userEvent.type(qtyInput, '40');
    // Change location to a different one (Main Pantry → Back Storage)
    const locSelect = screen.getByRole('combobox', { name: /Location/i });
    fireEvent.change(locSelect, { target: { name: 'location_id', value: '2' } });

    // Error banner appears above the form
    await waitFor(() => {
      expect(
        screen.getByText(/Cannot change both Quantity and Location/i)
      ).toBeInTheDocument();
    });

    // Valid data (Name field) was not cleared by the error state
    expect(screen.getByLabelText(/Name/i)).toHaveValue('Beans');
  });

  // --- Barcode Scanning Interface ---

  it('simulates barcode scan and auto-populates fields with visual feedback', async () => {
    // item_id present → component sets barcodeStatus to "KNOWN"
    api.fetchInventoryByBarcode.mockResolvedValue({
      item_id: 123,
      name: 'Heinz Baked Beans',
      category: 'Canned Goods',
      unit: 'cans',
      quantity: 10,
    });

    renderWithAuth(
      <AddItemModal open={true} mode="add" locations={[]} onClose={mockOnClose} onSave={mockOnSave} />
    );

    const barcodeInput = screen.getByLabelText(/Barcode/i);
    await userEvent.type(barcodeInput, '013000006408');

    await waitFor(
      () => {
        // Name auto-populated from barcode lookup
        expect(screen.getByLabelText(/Name/i)).toHaveValue('Heinz Baked Beans');
        // Visual feedback shown for a recognised barcode
        expect(screen.getByText(/Barcode already in inventory/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  // --- Button and Interaction States ---

  it('disables save buttons while loading to prevent duplicate submissions', () => {
    renderWithAuth(
      <AddItemModal
        open={true}
        isSaving={true}
        mode="add"
        locations={[]}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    // Submit button shows "Saving..." and is disabled while isSaving is true
    const submitButton = screen.getByRole('button', { name: /Saving.../i });
    expect(submitButton).toBeDisabled();
    // Cancel button is also disabled to prevent closing the modal during save
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    const disabledCancel = cancelButtons.find(btn => btn.hasAttribute('disabled'));
    expect(disabledCancel).toBeTruthy();
    expect(disabledCancel).toBeDisabled();
  });
});
