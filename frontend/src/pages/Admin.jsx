import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getAllUsers, createUser, getAllBankLocations, createLocation, updateLocation, deleteLocation } from '../services/api';
import UserManagementModal from '../components/admin/UserManagementModal';

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

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-500 transition";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Administration</h1>
          <p className="text-slate-500 mt-1">Manage users and locations for your organisation.</p>
        </header>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {['Users', 'Locations'].map((label, i) => (
            <button
              key={label}
              onClick={() => setAdminTab(i)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${
                adminTab === i
                  ? 'border-slate-800 text-slate-800'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ===================== USERS TAB ===================== */}
        {adminTab === 0 && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-800">User Management</h2>
              <button
                onClick={() => setCreateUserOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
              >
                <AddIcon fontSize="small" />
                Create User
              </button>
            </div>

            {usersLoading ? (
              <div className="text-center py-12 text-slate-400">Loading users…</div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Name', 'Email', 'Role', 'Locations', 'Status'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {users?.map((user) => (
                      <tr key={user.user_id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleOpenUserModal(user)}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
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
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">Pending Password Change</span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Create User Modal */}
            {createUserOpen && (
              <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-slate-800">Create New User</h2>
                  </div>
                  <form onSubmit={handleCreateUser}>
                    <div className="px-6 py-5 space-y-4">
                      {showPasswordAlert && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
                          <p className="font-semibold">Temporary Password: <span className="font-mono">{tempPassword}</span></p>
                          <p className="text-xs mt-1 text-green-700">Please save this — it won't be shown again.</p>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                          placeholder="Full name"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                          placeholder="email@example.com"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                        <select
                          value={formData.role_id || ''}
                          onChange={(e) => setFormData({ ...formData, role_id: e.target.value || null })}
                          className={inputClass}
                        >
                          <option value="">None (default user)</option>
                          <option value={1}>Admin</option>
                          <option value={2}>Manager</option>
                          <option value={3}>User</option>
                        </select>
                        <p className="text-xs text-slate-400 mt-1">Leave blank for default user role.</p>
                      </div>
                    </div>
                    <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={createUserMutation.isPending}
                        className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-xl hover:bg-slate-700 transition disabled:opacity-60"
                      >
                        {createUserMutation.isPending ? 'Creating…' : 'Create User'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <UserManagementModal user={selectedUser} open={userModalOpen} onClose={handleCloseUserModal} />
          </>
        )}

        {/* ===================== LOCATIONS TAB ===================== */}
        {adminTab === 1 && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Location Management</h2>
              <button
                onClick={() => handleOpenLocModal()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
              >
                <AddIcon fontSize="small" />
                Add Location
              </button>
            </div>

            {locsLoading ? (
              <div className="text-center py-12 text-slate-400">Loading locations…</div>
            ) : locations?.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No locations yet. Click "Add Location" to create one.
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Name', 'Address', 'Notes', ''].map((h, i) => (
                        <th key={i} className={`px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider ${i === 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {locations?.map((loc) => (
                      <tr key={loc.location_id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{loc.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{loc.address || '—'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{loc.notes || '—'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <button
                            onClick={() => handleOpenLocModal(loc)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-gray-100 hover:text-slate-700 transition mr-1"
                            title="Edit"
                          >
                            <EditIcon fontSize="small" />
                          </button>
                          <button
                            onClick={() => handleDeleteLocation(loc)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition"
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
            {locModalOpen && (
              <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-slate-800">
                      {editingLoc ? 'Edit Location' : 'Add Location'}
                    </h2>
                  </div>
                  <form onSubmit={handleSaveLocation}>
                    <div className="px-6 py-5 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                        <input
                          type="text"
                          value={locForm.name}
                          onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
                          required
                          placeholder="Location name"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                        <input
                          type="text"
                          value={locForm.address}
                          onChange={(e) => setLocForm({ ...locForm, address: e.target.value })}
                          placeholder="123 Main St"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                        <textarea
                          value={locForm.notes}
                          onChange={(e) => setLocForm({ ...locForm, notes: e.target.value })}
                          rows={2}
                          placeholder="Optional notes"
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={handleCloseLocModal}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={createLocMutation.isPending || updateLocMutation.isPending}
                        className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-xl hover:bg-slate-700 transition disabled:opacity-60"
                      >
                        {(createLocMutation.isPending || updateLocMutation.isPending) ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
