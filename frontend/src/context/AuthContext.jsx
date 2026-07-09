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

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem('ra_token'));
  const [loading, setLoading] = useState(true);

  // On mount, validate the stored token against the /me endpoint.
  // If the token is invalid or expired, log the user out silently.
  useEffect(() => {
    if (!token) { setLoading(false); return; }

    fetch('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.user) setUser(d.user); else logout(); })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, []);

  /** Persists a new JWT and updates the user state after a successful login or register. */
  const login = (tokenVal, userData) => {
    localStorage.setItem('ra_token', tokenVal);
    setToken(tokenVal);
    setUser(userData);
  };

  /** Removes the JWT from storage and clears the user session. */
  const logout = () => {
    localStorage.removeItem('ra_token');
    setToken(null);
    setUser(null);
  };

  /**
   * Authenticated fetch wrapper.
   * Automatically attaches `Authorization: Bearer <token>` to every request
   * and sets `Content-Type: application/json` by default.
   *
   * @param {string} url   - Request URL
   * @param {object} opts  - fetch options (method, body, headers, etc.)
   * @returns {Promise<Response>}
   */
  const authFetch = (url, opts = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(url, { ...opts, headers });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook to consume the auth context. Must be used within an AuthProvider. */
export const useAuth = () => useContext(AuthContext);
