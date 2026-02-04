import { useState } from 'react';
import { TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { changePassword } from '../services/api';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await changePassword(oldPassword, newPassword);
      setSuccess('Password changed successfully!');

      // Reset form
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        setChangePasswordOpen(false);
        setSuccess('');
      }, 2000);
    } catch (err) {
      const message = err.response?.data?.detail || 'Failed to change password';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">My Profile</h1>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Account Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <p className="text-lg text-slate-900">{user.name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <p className="text-lg text-slate-900">{user.email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <p className="text-lg text-slate-900 capitalize">{user.role_name || 'User'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bank ID</label>
            <p className="text-lg text-slate-900">{user.bank_id}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Security</h2>
        <Button
          variant="contained"
          onClick={() => setChangePasswordOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
          style={{ backgroundColor: '#4f46e5' }}
        >
          Change Password
        </Button>
      </div>

      {/* Change Password Modal */}
      <Dialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <form onSubmit={handlePasswordChange}>
          <DialogContent>
            {error && <Alert severity="error" className="mb-4">{error}</Alert>}
            {success && <Alert severity="success" className="mb-4">{success}</Alert>}

            <div className="space-y-4">
              <TextField
                label="Current Password"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                fullWidth
                helperText="Minimum 8 characters"
              />
              <TextField
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                fullWidth
              />
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setChangePasswordOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={loading} style={{ backgroundColor: '#4f46e5' }}>
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}
