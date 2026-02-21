import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField, Button, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { loginUser } from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await loginUser(email, password);

      // Store token and update auth context (wait for user info to load)
      await login(data.access_token, data.requires_password_change);

      // Redirect based on password change requirement
      if (data.requires_password_change) {
        navigate('/change-password');
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      console.error('Login failed:', err);
      const message = err.response?.data?.detail || 'Login failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</h1>
          <p className="text-slate-600">Sign in to your account</p>
        </div>

        {error && (
          <Alert severity="error" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            variant="outlined"
            className="bg-white"
          />

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            variant="outlined"
            className="bg-white"
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 py-3 text-lg"
            style={{ backgroundColor: '#4f46e5' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}
