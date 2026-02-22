import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  MenuItem,
  Tabs,
  Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getAllUsers, createUser, getAllBankLocations, createLocation, updateLocation, deleteLocation } from '../services/api';
import UserManagementModal from '../components/UserManagementModal';

export default function Admin() {
  const queryClient = useQueryClient();
  const [adminTab, setAdminTab] = useState(0);

  // --- Users state ---
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [showPasswordAlert, setShowPasswordAlert] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role_id: null });

  // --- Locations state ---
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  const [locForm, setLocForm] = useState({ name: '', address: '', notes: '' });

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getAllUsers,
  });

  // Fetch locations
  const { data: locations, isLoading: locsLoading } = useQuery({
    queryKey: ['bankLocations'],
    queryFn: getAllBankLocations,
  });

  // --- User mutations ---
  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setTempPassword(data.temporary_password);
      setShowPasswordAlert(true);
      setFormData({ name: '', email: '', role_id: null });
    },
    onError: (error) => {
      alert(error.response?.data?.detail || 'Failed to create user');
    },
  });

  // --- Location mutations ---
  const createLocMutation = useMutation({
    mutationFn: createLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankLocations'] });
      handleCloseLocModal();
    },
    onError: (error) => alert(error.response?.data?.detail || 'Failed to create location'),
  });

  const updateLocMutation = useMutation({
    mutationFn: ({ id, data }) => updateLocation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankLocations'] });
      handleCloseLocModal();
    },
    onError: (error) => alert(error.response?.data?.detail || 'Failed to update location'),
  });

  const deleteLocMutation = useMutation({
    mutationFn: deleteLocation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bankLocations'] }),
    onError: (error) => alert(error.response?.data?.detail || 'Failed to delete location'),
  });

  // --- User handlers ---
  const handleCreateUser = (e) => {
    e.preventDefault();
    createUserMutation.mutate(formData);
  };

  const handleCloseModal = () => {
    setCreateUserOpen(false);
    setShowPasswordAlert(false);
    setTempPassword('');
  };

  const handleOpenUserModal = (user) => {
    setSelectedUser(user);
    setUserModalOpen(true);
  };

  const handleCloseUserModal = () => {
    setUserModalOpen(false);
    setSelectedUser(null);
  };

  // --- Location handlers ---
  const handleOpenLocModal = (loc = null) => {
    setEditingLoc(loc);
    setLocForm(loc ? { name: loc.name || '', address: loc.address || '', notes: loc.notes || '' } : { name: '', address: '', notes: '' });
    setLocModalOpen(true);
  };

  const handleCloseLocModal = () => {
    setLocModalOpen(false);
    setEditingLoc(null);
    setLocForm({ name: '', address: '', notes: '' });
  };

  const handleSaveLocation = (e) => {
    e.preventDefault();
    if (editingLoc) {
      updateLocMutation.mutate({ id: editingLoc.location_id, data: locForm });
    } else {
      createLocMutation.mutate(locForm);
    }
  };

  const handleDeleteLocation = (loc) => {
    if (window.confirm(`Delete location "${loc.name}"? Inventory items at this location will lose their location assignment.`)) {
      deleteLocMutation.mutate(loc.location_id);
    }
  };

  if (usersLoading && adminTab === 0) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">Administration</h1>

      <Tabs value={adminTab} onChange={(_, v) => setAdminTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Users" />
        <Tab label="Locations" />
      </Tabs>

      {/* ===================== USERS TAB ===================== */}
      {adminTab === 0 && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-slate-800">User Management</h2>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateUserOpen(true)}
              style={{ backgroundColor: '#4f46e5' }}
            >
              Create User
            </Button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Locations</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users?.map((user) => (
                  <tr key={user.user_id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleOpenUserModal(user)}
                        className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium cursor-pointer"
                      >
                        {user.name}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 capitalize">{user.role_name || 'User'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {user.locations?.length
                        ? user.locations.map((l) => l.name).join(', ')
                        : <span className="text-slate-400">None</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {user.requires_password_change ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending Password Change</span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Create User Modal */}
          <Dialog open={createUserOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
            <DialogTitle>Create New User</DialogTitle>
            <form onSubmit={handleCreateUser}>
              <DialogContent>
                {showPasswordAlert && (
                  <Alert severity="success" className="mb-4">
                    <strong>Temporary Password:</strong> {tempPassword}
                    <br />
                    <em>Please save this password - it won't be shown again!</em>
                  </Alert>
                )}
                <div className="space-y-4">
                  <TextField label="Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required fullWidth />
                  <TextField label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required fullWidth />
                  <TextField label="Role" select value={formData.role_id || ''} onChange={(e) => setFormData({ ...formData, role_id: e.target.value || null })} fullWidth helperText="Leave blank for default user role">
                    <MenuItem value="">None</MenuItem>
                    <MenuItem value={1}>Admin</MenuItem>
                    <MenuItem value={2}>Manager</MenuItem>
                    <MenuItem value={3}>User</MenuItem>
                  </TextField>
                </div>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCloseModal}>Cancel</Button>
                <Button type="submit" variant="contained" disabled={createUserMutation.isPending} style={{ backgroundColor: '#4f46e5' }}>
                  {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                </Button>
              </DialogActions>
            </form>
          </Dialog>

          <UserManagementModal user={selectedUser} open={userModalOpen} onClose={handleCloseUserModal} />
        </>
      )}

      {/* ===================== LOCATIONS TAB ===================== */}
      {adminTab === 1 && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Location Management</h2>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenLocModal()}
              style={{ backgroundColor: '#4f46e5' }}
            >
              Add Location
            </Button>
          </div>

          {locsLoading ? (
            <div className="text-center py-8">Loading locations...</div>
          ) : locations?.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No locations yet. Click "Add Location" to create one.
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Notes</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {locations?.map((loc) => (
                    <tr key={loc.location_id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{loc.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{loc.address || '—'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{loc.notes || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <button
                          onClick={() => handleOpenLocModal(loc)}
                          className="p-1 rounded-full text-slate-600 hover:bg-gray-100 mr-1"
                          title="Edit"
                        >
                          <EditIcon fontSize="small" />
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(loc)}
                          className="p-1 rounded-full text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <DeleteIcon fontSize="small" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add/Edit Location Modal */}
          <Dialog open={locModalOpen} onClose={handleCloseLocModal} maxWidth="sm" fullWidth>
            <DialogTitle>{editingLoc ? 'Edit Location' : 'Add Location'}</DialogTitle>
            <form onSubmit={handleSaveLocation}>
              <DialogContent>
                <div className="space-y-4">
                  <TextField label="Name" value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} required fullWidth />
                  <TextField label="Address" value={locForm.address} onChange={(e) => setLocForm({ ...locForm, address: e.target.value })} fullWidth />
                  <TextField label="Notes" value={locForm.notes} onChange={(e) => setLocForm({ ...locForm, notes: e.target.value })} fullWidth multiline rows={2} />
                </div>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCloseLocModal}>Cancel</Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={createLocMutation.isPending || updateLocMutation.isPending}
                  style={{ backgroundColor: '#4f46e5' }}
                >
                  {(createLocMutation.isPending || updateLocMutation.isPending) ? 'Saving...' : 'Save'}
                </Button>
              </DialogActions>
            </form>
          </Dialog>
        </>
      )}
    </div>
  );
}
