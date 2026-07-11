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
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-[420px] shadow-xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center font-bold font-heading text-white">AI</div>
          <h2 className="text-xl font-semibold text-white flex-1">Research Agent</h2>
          <button className="bg-transparent border-none text-zinc-500 text-lg cursor-pointer hover:text-white transition-colors" onClick={onClose}>✕</button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-zinc-950 rounded-lg p-1 mb-6">
          <button
            className={`flex-1 py-2 px-3 border-none bg-transparent text-sm font-semibold rounded-md cursor-pointer transition-all ${tab === 'login' ? 'bg-zinc-900 text-white shadow-sm border border-zinc-800' : 'text-zinc-500'}`}
            onClick={() => switchTab('login')}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-2 px-3 border-none bg-transparent text-sm font-semibold rounded-md cursor-pointer transition-all ${tab === 'register' ? 'bg-zinc-900 text-white shadow-sm border border-zinc-800' : 'text-zinc-500'}`}
            onClick={() => switchTab('register')}
          >
            Register
          </button>
        </div>

        {/* Auth form */}
        <form className="flex flex-col gap-4" onSubmit={submit}>
          {tab === 'register' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Full Name</label>
              <input
                className="bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 text-white font-sans text-base transition-all focus:border-blue-500 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.2)] outline-none"
                type="text"
                name="name"
                placeholder="John Doe"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Email</label>
            <input
              className="bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 text-white font-sans text-base transition-all focus:border-blue-500 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.2)] outline-none"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Password</label>
            <input
              className="bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 text-white font-sans text-base transition-all focus:border-blue-500 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.2)] outline-none"
              type="password"
              name="password"
              placeholder={tab === 'register' ? 'Minimum 6 characters' : '••••••••'}
              value={form.password}
              onChange={handleChange}
              minLength={6}
              required
            />
          </div>

          {error && <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 text-red-400 text-sm" className="p-2.5 mt-2.5">{error}</div>}

          <button className="inline-flex items-center justify-center gap-1.5 bg-blue-500 text-white border-none rounded-lg py-2 px-5 text-sm font-semibold cursor-pointer hover:bg-blue-600 hover:-translate-y-[1px] hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed" type="submit" disabled={loading} className="w-full mt-2">
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-400">
          {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            className="bg-transparent border-none text-blue-500 font-medium cursor-pointer hover:underline"
            onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
          >
            {tab === 'login' ? 'Register' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}
