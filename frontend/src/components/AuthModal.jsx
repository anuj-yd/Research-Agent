/**
 * @file AuthModal.jsx
 * @description Modal dialog for user authentication (Sign In / Register).
 *
 * Renders a tab-switched form that posts to the backend auth endpoints.
 * On success, calls `login()` from AuthContext and closes the modal.
 *
 * @prop {Function} onClose - Callback invoked when the modal should close
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

/** Eye-open SVG icon for the password visibility toggle. */
function EyeOpen() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

/** Eye-closed SVG icon for the password visibility toggle. */
function EyeClosed() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

export default function AuthModal({ onClose }) {
  const [tab, setTab]           = useState('login'); // 'login' | 'register'
  const [form, setForm]         = useState({ name: '', email: '', password: '' });
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login }               = useAuth();

  /** Controlled input handler — updates the matching form field by input name. */
  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  /** Submits the form to the appropriate auth endpoint based on the active tab. */
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const isLogin  = tab === 'login';
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload  = isLogin
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };

      const r = await api.post(endpoint, payload);
      login(r.data.token, r.data.user);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  /** Switches tabs and clears any lingering error or password visibility state. */
  const switchTab = (next) => { setTab(next); setError(''); setShowPass(false); };

  const inputCls = 'w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-white font-sans text-base transition-all focus:border-blue-500 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.2)] outline-none';
  const labelCls = 'text-xs text-zinc-400 font-medium uppercase tracking-wide';

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
            className={`flex-1 py-2 px-3 border-none rounded-md cursor-pointer transition-all text-sm font-semibold ${tab === 'login' ? 'bg-zinc-800 text-white shadow-sm' : 'bg-transparent text-zinc-500 hover:text-zinc-300'}`}
            onClick={() => switchTab('login')}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-2 px-3 border-none rounded-md cursor-pointer transition-all text-sm font-semibold ${tab === 'register' ? 'bg-zinc-800 text-white shadow-sm' : 'bg-transparent text-zinc-500 hover:text-zinc-300'}`}
            onClick={() => switchTab('register')}
          >
            Register
          </button>
        </div>

        {/* Auth form */}
        <form className="flex flex-col gap-4" onSubmit={submit}>

          {/* Full name — only shown on the Register tab */}
          {tab === 'register' && (
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Full Name</label>
              <input
                className={inputCls}
                type="text"
                name="name"
                placeholder="John Doe"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
          )}

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Email</label>
            <input
              className={inputCls}
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          {/* Password with show/hide toggle */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Password</label>
            <div className="relative">
              <input
                className={`${inputCls} pr-10`}
                type={showPass ? 'text' : 'password'}
                name="password"
                placeholder={tab === 'register' ? 'Minimum 6 characters' : '••••••••'}
                value={form.password}
                onChange={handleChange}
                minLength={6}
                required
              />
              {/* Toggle password visibility */}
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                onClick={() => setShowPass(v => !v)}
                title={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeClosed /> : <EyeOpen />}
              </button>
            </div>
          </div>

          {/* Inline error message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-3 py-2.5 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            className="w-full mt-1 inline-flex items-center justify-center bg-blue-500 text-white border-none rounded-lg py-2.5 px-5 text-sm font-semibold cursor-pointer hover:bg-blue-600 hover:-translate-y-[1px] hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Tab switch link */}
        <p className="mt-5 text-center text-sm text-zinc-400">
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
