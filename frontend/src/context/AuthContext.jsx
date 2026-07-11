/**
 * @file AuthContext.jsx
 * @description Global authentication context for the application.
 *
 * Provides:
 *   - `user`      — decoded JWT payload (null when not authenticated)
 *   - `token`     — raw JWT string persisted to localStorage
 *   - `loading`   — true while the token is being validated on mount
 *   - `login()`   — stores token and sets user state after a successful auth call
 *   - `logout()`  — clears token from storage and resets state
 *   - `authFetch` — wrapper around fetch that automatically attaches the Bearer token
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem('ra_token'));
  const [loading, setLoading] = useState(true);

  // On mount, validate the stored token against the /me endpoint.
  useEffect(() => {
    if (!token) { setLoading(false); return; }

    api.get('/api/auth/me')
      .then(r => { if (r.data.user) setUser(r.data.user); else logout(); })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, []);

  const login = (tokenVal, userData) => {
    localStorage.setItem('ra_token', tokenVal);
    setToken(tokenVal);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('ra_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
