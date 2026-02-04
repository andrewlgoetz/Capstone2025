import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        // Check if token is expired
        if (decoded.exp * 1000 < Date.now()) {
          logout();
        } else {
          // Token is valid, fetch user info
          fetchUserInfo(token);
        }
      } catch (error) {
        console.error('Invalid token:', error);
        logout();
      }
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserInfo = async (token) => {
    try {
      console.log('Fetching user info with token:', token.substring(0, 20) + '...');
      const response = await fetch('http://127.0.0.1:8000/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Auth response status:', response.status);

      if (response.ok) {
        const userData = await response.json();
        console.log('User data received:', userData);
        setUser(userData);
      } else {
        const errorData = await response.text();
        console.error('Auth failed:', response.status, errorData);
        logout();
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (token, requiresPasswordChange) => {
    console.log('Login called, requiresPasswordChange:', requiresPasswordChange);
    localStorage.setItem('access_token', token);

    if (requiresPasswordChange) {
      // Don't fetch user info yet, just store token and redirect
      console.log('Password change required, skipping user fetch');
      setUser({ requires_password_change: true });
      setLoading(false);
    } else {
      console.log('Fetching user info after login');
      await fetchUserInfo(token);
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setUser(null);
    setLoading(false);
  };

  const refreshUser = () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchUserInfo(token);
    }
  };

  const isAdmin = () => {
    return user && user.role_name && user.role_name.toLowerCase() === 'admin';
  };

  const value = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    isAdmin,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
