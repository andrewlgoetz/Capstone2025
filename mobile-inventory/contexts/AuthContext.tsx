import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  login as apiLogin,
  getMe,
  getMyPermissions,
  getStoredToken,
  storeToken,
  clearToken,
  type UserInfo,
  type UserLocation,
} from '../services/api';

interface AuthContextType {
  user: UserInfo | null;
  permissions: string[];
  userLocations: UserLocation[];
  loading: boolean;
  login: (email: string, password: string) => Promise<{ requiresPasswordChange: boolean }>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
  isAdmin: () => boolean;
  /** Call after password change to finish loading user data */
  finishLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    try {
      const [userData, permData] = await Promise.all([getMe(), getMyPermissions()]);
      setUser(userData);
      setPermissions(permData.permissions || []);
    } catch {
      // Token invalid or expired
      await clearToken();
      setUser(null);
      setPermissions([]);
    }
  }, []);

  // Check for existing token on mount
  useEffect(() => {
    (async () => {
      const token = await getStoredToken();
      if (token) {
        await fetchUserData();
      }
      setLoading(false);
    })();
  }, [fetchUserData]);

  const login = async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    await storeToken(response.access_token);

    if (response.requires_password_change) {
      // Set minimal user so the app knows we're "logged in" but need password change
      setUser({ requires_password_change: true } as UserInfo);
      return { requiresPasswordChange: true };
    }

    await fetchUserData();
    return { requiresPasswordChange: false };
  };

  const logout = async () => {
    await clearToken();
    setUser(null);
    setPermissions([]);
  };

  const finishLogin = async () => {
    await fetchUserData();
  };

  const isAdmin = () => {
    return !!user?.role_name && user.role_name.toLowerCase() === 'admin';
  };

  const hasPermission = (perm: string) => {
    if (isAdmin()) return true;
    return permissions.includes(perm);
  };

  const userLocations = user?.locations || [];

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        userLocations,
        loading,
        login,
        logout,
        hasPermission,
        isAdmin,
        finishLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
