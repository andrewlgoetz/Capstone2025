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
  MenuItem
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { getAllUsers, createUser } from '../services/api';
import UserManagementModal from '../components/UserManagementModal';

export default function Admin() {
  const queryClient = useQueryClient();
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [showPasswordAlert, setShowPasswordAlert] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bank_id: 1,
    role_id: null
  });

  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getAllUsers
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setTempPassword(data.temporary_password);
      setShowPasswordAlert(true);
      setFormData({ name: '', email: '', bank_id: 1, role_id: null });
    },
    onError: (error) => {
      const message = error.response?.data?.detail || 'Failed to create user';
      alert(message);
    }
  });

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

  if (isLoading) {
    return <div className="text-center py-8">Loading users...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateUserOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
          style={{ backgroundColor: '#4f46e5' }}
        >
          Create User
        </Button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                Bank ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                Status
              </th>
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 capitalize">
                  {user.role_name || 'User'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                  {user.bank_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {user.requires_password_change ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Pending Password Change
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
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
              <TextField
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Bank ID"
                type="number"
                value={formData.bank_id}
                onChange={(e) => setFormData({ ...formData, bank_id: parseInt(e.target.value) })}
                required
                fullWidth
              />
              <TextField
                label="Role"
                select
                value={formData.role_id || ''}
                onChange={(e) => setFormData({ ...formData, role_id: e.target.value || null })}
                fullWidth
                helperText="Leave blank for default user role"
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value={1}>Admin</MenuItem>
                <MenuItem value={2}>Manager</MenuItem>
                <MenuItem value={3}>User</MenuItem>
              </TextField>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseModal}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createUserMutation.isPending}
              style={{ backgroundColor: '#4f46e5' }}
            >
              {createUserMutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* User Management Modal */}
      <UserManagementModal
        user={selectedUser}
        open={userModalOpen}
        onClose={handleCloseUserModal}
      />
    </div>
  );
}
