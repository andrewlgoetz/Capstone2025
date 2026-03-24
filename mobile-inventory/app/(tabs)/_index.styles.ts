import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
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
  categoryInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryInputText: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  categoryPickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  categoryPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  categoryPickerContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  pickerSearchInput: {
    margin: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    fontSize: 15,
    color: '#333',
  },
  categoryPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  categoryPickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  categoryPickerClose: {
    fontSize: 24,
    color: '#999',
    fontWeight: '300',
  },
  categoryPickerScroll: {
    maxHeight: 400,
  },
  categoryPickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryPickerOptionActive: {
    backgroundColor: '#f0f0ff',
  },
  categoryPickerOptionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  categoryPickerOptionTextActive: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  categoryPickerCheck: {
    fontSize: 18,
    color: '#4f46e5',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  // Auth-related styles
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

  // Location selector styles
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
  noPermText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },

  // Location picker for new item form
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
