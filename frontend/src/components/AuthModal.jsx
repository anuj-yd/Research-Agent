/**
 * @file AuthModal.jsx
 * @description Modal dialog for user authentication (Sign In / Register).
 *
 * Renders a tab-switched form that posts to the backend auth endpoints.
 * On success, calls `login()` from AuthContext and closes the modal.
 *
 * @prop {Function} onClose - Callback to close the modal
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function AuthModal({ onClose }) {
  const [tab, setTab]         = useState('login'); // 'login' | 'register'
  const [form, setForm]       = useState({ name: '', email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const { login }             = useAuth();

  /** Controlled input handler — updates the form field matching `e.target.name`. */
  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  /** Submits the form to the appropriate auth endpoint based on the active tab. */
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const isLogin = tab === 'login';
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };

      const r = await api.post(endpoint, payload);
      const d = r.data;
      login(d.token, d.user);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  /** Switches between login and register tabs, clearing any previous error. */
  const switchTab = (next) => { setTab(next); setError(''); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-logo">AI</div>
          <h2 className="modal-title">Research Agent</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tab switcher */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
          >
            Sign In
          </button>
          <button
            className={`modal-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => switchTab('register')}
          >
            Register
          </button>
        </div>

        {/* Auth form */}
        <form className="modal-form" onSubmit={submit}>
          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                name="name"
                placeholder="John Doe"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              name="password"
              placeholder={tab === 'register' ? 'Minimum 6 characters' : '••••••••'}
              value={form.password}
              onChange={handleChange}
              minLength={6}
              required
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <button className="form-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="modal-footer-note">
          {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            className="modal-switch-link"
            onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
          >
            {tab === 'login' ? 'Register' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}
