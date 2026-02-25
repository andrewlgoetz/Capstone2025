import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField, Button, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { changePassword } from '../services/api';

export default function ChangePassword() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { refreshUser, user } = useAuth();
  const navigate = useNavigate();

  const isForced = user?.requires_password_change;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
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

      // Refresh user info to clear requires_password_change flag
      await refreshUser();

      // Redirect to home
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Password change failed:', err);
      const message = err.response?.data?.detail || 'Failed to change password. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {isForced ? 'Change Your Password' : 'Update Password'}
          </h1>
          {isForced && (
            <p className="text-slate-600">
              For security reasons, you must change your temporary password before continuing.
            </p>
          )}
        </div>

        {error && (
          <Alert severity="error" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <TextField
            label="Current Password"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
            fullWidth
            variant="outlined"
          />

          <TextField
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            fullWidth
            variant="outlined"
            helperText="Minimum 8 characters"
          />

          <TextField
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            fullWidth
            variant="outlined"
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 py-3 text-lg"
            style={{ backgroundColor: '#4f46e5' }}
          >
            {loading ? 'Updating...' : 'Change Password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
