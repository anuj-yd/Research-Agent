/**
 * @file App.jsx
 * @description Root React application for the AI Investment Research Agent.
 *
 * View routing is handled via a single `view` state (no react-router page switching).
 * Views: home | reports | watch | compare
 *
 * Data flow:
 *   User types query → ChatInput → analyze() → POST /api/analyze → ResultsView
 */

import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthModal from './components/AuthModal';
import api from './api';
import { ScoreRadar, MetricsBar } from './components/Charts';
import NewsPanel from './components/NewsPanel';

// ---------------------------------------------------------------------------
// SVG Icon Components
// All icons use a consistent stroke-based design system.
// ---------------------------------------------------------------------------

const Icon = ({ d, size = 18, strokeWidth = 1.8 }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const HomeIco    = () => <Icon d="M3 9.75L12 3l9 6.75V21a.75.75 0 01-.75.75H15.75a.75.75 0 01-.75-.75v-4.5h-6V21a.75.75 0 01-.75.75H3.75A.75.75 0 013 21V9.75z" />;
const ReportsIco = () => <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />;
const WatchIco   = () => <Icon d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />;
const SettingsIco= () => <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />;
const ChevDown   = () => <Icon d="M6 9l6 6 6-6" size={12} strokeWidth={2.5} />;
const BackIco    = () => <Icon d="M19 12H5M12 19l-7-7 7-7" size={14} strokeWidth={2} />;
const SendIco    = () => <Icon d="M12 19V5M5 12l7-7 7 7" size={16} strokeWidth={2.2} />;
const SparkIco   = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l1.5 3L9 7.5 6.5 9 5 12l-1.5-3L1 7.5 3.5 6 5 3zM19 11l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM12 1l1.5 3L16 5.5 13.5 7 12 10l-1.5-3L8 5.5 10.5 4 12 1z"/>
  </svg>
);
const SaveIco    = () => <Icon d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" size={14} strokeWidth={2} />;
const TrashIco   = () => <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={14} strokeWidth={2} />;
const PDFIco     = () => <Icon d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z M12 3v6h6" size={14} strokeWidth={2} />;
const SearchIco  = () => <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={14} strokeWidth={2} />;

// ---------------------------------------------------------------------------
// Sidebar
// Renders the icon-only navigation rail on the left side of the app.
// The settings icon at the bottom opens auth (sign-in) or signs out.
// ---------------------------------------------------------------------------

function Sidebar({ onAuthClick, onLogout }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { id: 'home',    path: '/',          Icon: HomeIco,    label: 'Home' },
    { id: 'reports', path: '/reports',   Icon: ReportsIco, label: 'Saved Reports' },
    { id: 'watch',   path: '/watchlist', Icon: WatchIco,   label: 'Watchlist' },
  ];

  const getActive = () => {
    if (location.pathname.startsWith('/analyze')) return 'home';
    const activeItem = navItems.find(item => item.path === location.pathname);
    return activeItem ? activeItem.id : 'home';
  };
  const activeId = getActive();

  return (
    <aside className="w-[80px] h-full bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-6 gap-4 z-10 shrink-0">
      <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-400 rounded-lg flex items-center justify-center font-bold font-heading text-white mb-6 shadow-lg shadow-blue-500/20">AI</div>
      <nav className="flex flex-col items-center gap-2 flex-1">
        {navItems.map(({ id, path, Icon: I, label }) => (
          <button
            key={id}
            title={label}
            className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${activeId === id ? 'bg-zinc-800/50 text-blue-500 shadow-[inset_2px_0_0_#3b82f6]' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
            onClick={() => navigate(path)}
          >
            <I />
          </button>
        ))}
      </nav>
      <div className="flex flex-col items-center gap-2">
        <button
          className="w-12 h-12 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all"
          title={user ? 'Sign out' : 'Sign in'}
          onClick={user ? onLogout : onAuthClick}
        >
          <SettingsIco />
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Topbar
// Displays the current user's avatar and name in the top-right corner.
// Clicking the badge signs the user out if logged in, or opens auth modal.
// ---------------------------------------------------------------------------

function Topbar({ onAuthClick }) {
  const { user, logout } = useAuth();
  return (
    <div className="flex justify-end items-center py-4 px-8 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 z-10">
      {user ? (
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full py-1 pr-4 pl-1 cursor-pointer hover:bg-zinc-800 hover:border-zinc-500 transition-all" onClick={logout} title="Click to sign out">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-semibold text-white">{user.name?.[0]?.toUpperCase() || 'U'}</div>
          <span className="text-sm font-medium text-white">{user.name}</span>
          <ChevDown />
        </div>
      ) : (
        <button className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full py-1 pr-4 pl-1 cursor-pointer hover:bg-zinc-800 hover:border-zinc-500 transition-all" onClick={onAuthClick} style={{ cursor: 'pointer' }}>
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-semibold text-white">?</div>
          <span className="text-sm font-medium text-white">Sign In</span>
          <ChevDown />
        </button>
      )}
    </div>
  );
}



// ---------------------------------------------------------------------------
// ChatInput
// Shared text input component used on the home screen and the results view.
// Submits on Enter (Shift+Enter inserts a newline).
// ---------------------------------------------------------------------------

function ChatInput({ value, onChange, onSubmit, loading, placeholder = 'Enter Company Name' }) {
  const ref = useRef(null);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="w-full max-w-[700px] bg-zinc-900 border border-zinc-800 rounded-full px-5 py-3 flex items-center gap-3 shadow-lg focus-within:border-zinc-600 transition-all">
      <input
        ref={ref}
        type="text"
        className="flex-1 bg-transparent border-none outline-none text-white text-base font-sans placeholder-zinc-500"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKey}
      />
      <button
        className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center shrink-0 cursor-pointer hover:bg-blue-400 hover:scale-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
        onClick={onSubmit}
        disabled={!value.trim() || loading}
        title="Analyze"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HomeView
// Landing screen shown when no analysis is active.
// Displays quick-action cards and pill shortcut buttons.
// ---------------------------------------------------------------------------

function HomeView({ onAnalyze, loading }) {
  const [q, setQ] = useState('');


  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8 overflow-y-auto bg-[radial-gradient(circle_at_center,_#131316_0%,_#09090b_100%)]">
      <div className="text-center w-full max-w-[620px] mb-8">
        <h1 className="font-heading text-3xl md:text-4xl font-semibold text-white leading-tight tracking-tight">Hey! Investor<br />Which company should I analyze?</h1>
      </div>
      <ChatInput
        value={q}
        onChange={setQ}
        onSubmit={() => { if (q.trim()) onAnalyze(q.trim()); }}
        loading={loading}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoadingView
// Displayed while the LangChain agent is gathering data and the report
// is being generated by Gemini. Typically takes 20–40 seconds.
// ---------------------------------------------------------------------------

function LoadingView({ query }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-zinc-950">
      <div className="w-12 h-12 rounded-full border-4 border-zinc-800 border-t-blue-500 animate-spin" />
      <p className="text-lg text-white font-medium tracking-wide flex items-center gap-1">
        Analyzing <strong className="text-blue-500">{query?.toUpperCase()}</strong>
        <span className="after:content-[''] after:animate-ping after:w-1 after:h-1 after:bg-white after:rounded-full after:ml-1 after:inline-block" />
      </p>
      <p className="text-xs text-zinc-400">
        LangChain agent gathering financial data &amp; news…
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultsView
// Displays the structured investment report returned by the backend.
// Includes: recommendation badge, score cards, Recharts visualisations,
// SWOT analysis, live news panel, and save/watchlist action buttons.
// ---------------------------------------------------------------------------

function ResultsView({ data, symbol, onBack, onNewQuery }) {
  const { user } = useAuth();
  const [q, setQ]           = useState('');
  const [saved, setSaved]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [watched, setWatched] = useState(false);

  const recCls = { BUY: 'rec-buy', HOLD: 'rec-hold', PASS: 'rec-sell' }[data.recommendation] || 'rec-hold';

  /** Persists the current report to the database for the signed-in user. */
  const saveReport = async () => {
    if (!user) { alert('Sign in to save reports'); return; }
    setSaving(true);
    try {
      await api.post('/api/reports/save', {
        ticker:         symbol,
        companyName:    data.companyOverview?.name || symbol,
        recommendation: data.recommendation,
        score:          data.investmentScore?.overallScore || 0,
        reasoning:      data.reasoning,
        financialData:  data.financialAnalysis,
        swot:           data.swotAnalysis,
        fullReport:     data,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  /** Adds the current stock to the user's watchlist. */
  const addWatch = async () => {
    if (!user) { alert('Sign in to use watchlist'); return; }
    try {
      await api.post('/api/watchlist', {
        symbol:      symbol,
        companyName: data.companyOverview?.name || symbol,
      });
      setWatched(true);
    } catch (e) {
      console.error(e);
    }
  };

  const scores = [
    { label: 'Overall',   value: data.investmentScore?.overallScore },
    { label: 'Growth',    value: data.investmentScore?.growthScore },
    { label: 'Health',    value: data.investmentScore?.financialHealth },
    { label: 'Risk',      value: data.investmentScore?.riskScore },
    { label: 'Valuation', value: data.investmentScore?.valuationScore },
  ];

  const metrics = [
    { label: 'P/E Ratio',    value: data.financialAnalysis?.peRatio },
    { label: 'EPS',          value: data.financialAnalysis?.eps },
    { label: 'Rev. Growth',  value: data.financialAnalysis?.revenueGrowth },
    { label: 'ROE',          value: data.financialAnalysis?.roe },
    { label: 'Oper. Margin', value: data.financialAnalysis?.operatingMargin },
    { label: 'Debt/Equity',  value: data.financialAnalysis?.debtToEquity },
  ];

  const swotSections = [
    { key: 'strengths',     cls: 'swot-strengths',     label: '⚡ Strengths',     data: data.swotAnalysis?.strengths     || [] },
    { key: 'weaknesses',    cls: 'swot-weaknesses',    label: '⚠ Weaknesses',    data: data.swotAnalysis?.weaknesses    || [] },
    { key: 'opportunities', cls: 'swot-opportunities', label: '🌐 Opportunities', data: data.swotAnalysis?.opportunities || [] },
    { key: 'threats',       cls: 'swot-threats',       label: '🔴 Threats',       data: data.swotAnalysis?.threats       || [] },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-[1400px] mx-auto w-full animate-[fadeIn_0.4s_ease-out_forwards]">

        {/* Navigation and action toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
          <button className="inline-flex items-center justify-center gap-1.5 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-xl py-2 px-5 text-sm font-medium cursor-pointer hover:bg-zinc-800 hover:text-white hover:border-zinc-500 transition-all" onClick={onBack}><BackIco /> Back to home</button>
          <div className="flex gap-2">
            <button
              className={`inline-flex items-center justify-center gap-1.5 border rounded-xl py-2 px-4 text-sm font-medium cursor-pointer transition-all ${watched ? 'bg-blue-500 text-white border-blue-500' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-white hover:border-zinc-400'}`}
              onClick={addWatch}
              title="Add to watchlist"
            >
              <WatchIco /> {watched ? 'Watching' : 'Watch'}
            </button>
            <button
              className={`inline-flex items-center justify-center gap-1.5 border rounded-xl py-2 px-4 text-sm font-medium cursor-pointer transition-all ${saved ? 'bg-blue-500 text-white border-blue-500' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-white hover:border-zinc-400'}`}
              onClick={saveReport}
              disabled={saving}
              title="Save report"
            >
              <SaveIco /> {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Report'}
            </button>
          </div>
        </div>

        {/* Company header and recommendation */}
        <div className="flex items-center justify-between flex-wrap gap-6 mb-8">
          <div>
            <div className="font-heading text-3xl font-bold text-white tracking-tight">{data.companyOverview?.name || symbol.toUpperCase()}</div>
            <div className="flex gap-2 flex-wrap mt-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border bg-blue-500/10 text-blue-400 border-blue-500/30">{symbol.toUpperCase()}</span>
              {typeof data.dataSource === 'string' && (
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${data.dataSource.includes('Real') ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-amber-500/10 text-amber-500 border-amber-500/30'}`}>
                  {data.dataSource.includes('Real') ? '📡 Live Data' : '🧠 AI Knowledge Base'}
                </span>
              )}
              {data.cached && (
                <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border bg-purple-500/10 text-purple-400 border-purple-500/30" title="Report retrieved from cache (generated within last 24h)">
                  ⚡ Cached Report
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-xs uppercase tracking-widest text-zinc-400 mb-1">Recommendation</div>
            <div className={`font-heading text-2xl font-bold tracking-wide px-5 py-2 rounded-xl border-2 shadow-[0_0_20px_rgba(0,0,0,0.1)] ${recCls === 'rec-buy' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500' : recCls === 'rec-sell' ? 'bg-red-500/10 text-red-500 border-red-500' : 'bg-amber-500/10 text-amber-500 border-amber-500'}`}>{data.recommendation || 'HOLD'}</div>
          </div>
        </div>

        {/* Score summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {scores.map((s, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center hover:-translate-y-1 hover:shadow-lg hover:border-zinc-600 transition-all group relative overflow-hidden">
              <div className="text-xs uppercase tracking-widest text-zinc-400 font-medium mb-2">{s.label}</div>
              <div className="font-heading text-2xl font-bold text-white">{s.value ?? '--'}</div>
            </div>
          ))}
        </div>

        {/* Recharts visualisations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ScoreRadar scores={data.investmentScore} />
          <MetricsBar financialAnalysis={data.financialAnalysis} />
        </div>

        {/* Detail panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Investment thesis and confidence */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-md">
            <div className="font-heading text-xl font-semibold text-white mb-4 flex items-center gap-2">⚡ Investment Thesis</div>
            <p className="text-base text-zinc-400 leading-relaxed mb-6">{data.reasoning || 'No reasoning available.'}</p>
            <div className="bg-white/5 border-l-4 border-blue-500 rounded-r-xl p-4">
              <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Confidence: </span>
              <span className="text-white font-semibold ml-2">{data.confidenceLevel || 'Medium'}</span>
              {data.confidenceExplanation && (
                <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{data.confidenceExplanation}</p>
              )}
            </div>
          </div>

          {/* News Sentiment Panel — derived from Finnhub + Gemini current affairs */}
          {data.newsSentiment && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-md">
              <div className="font-heading text-xl font-semibold text-white mb-4 flex items-center gap-2">📡 News Sentiment</div>
              <div className="flex items-center gap-4 mb-4">
                <span
                  className={`font-heading font-bold tracking-wide rounded-xl border-2 shadow-lg text-xs px-5 py-1 ${data.newsSentiment.sentiment === 'Bullish' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500' : data.newsSentiment.sentiment === 'Bearish' ? 'bg-red-500/10 text-red-500 border-red-500' : 'bg-amber-500/10 text-amber-500 border-amber-500'}`}
                >
                  {data.newsSentiment.sentiment === 'Bullish' ? '📈 ' : data.newsSentiment.sentiment === 'Bearish' ? '📉 ' : '➡️ '}
                  {data.newsSentiment.sentiment}
                </span>
                <p className="text-xs text-zinc-400 m-0 flex-1">
                  {data.newsSentiment.newsImpact}
                </p>
              </div>
              {Array.isArray(data.newsSentiment.keyHeadlines) && data.newsSentiment.keyHeadlines.length > 0 && (
                <ul className="flex flex-col gap-3 mt-2">
                  {data.newsSentiment.keyHeadlines.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                      <span className="w-2 h-2 rounded-full shrink-0 mt-1.5 bg-blue-500" />{h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Key financial metrics */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-md">
            <div className="font-heading text-xl font-semibold text-white mb-4 flex items-center gap-2">📊 Financial Overview</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {metrics.map((m, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl px-5 py-4 flex flex-col justify-center hover:bg-white/10 transition-colors">
                  <div className="text-xs text-zinc-400 uppercase tracking-wide mb-1">{m.label}</div>
                  <div className="font-heading text-xl font-semibold text-white">{m.value || '--'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SWOT analysis grid */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-md lg:col-span-2">
            <div className="font-heading text-xl font-semibold text-white mb-4 flex items-center gap-2">SWOT Analysis</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {swotSections.map(s => (
                <div key={s.key} className={`bg-white/5 border border-white/10 rounded-2xl p-5 border-t-4 ${s.key === 'strengths' ? 'border-t-emerald-500' : s.key === 'weaknesses' ? 'border-t-red-500' : s.key === 'opportunities' ? 'border-t-blue-500' : 'border-t-amber-500'}`}>
                  <div className="font-heading text-lg font-semibold mb-3 text-white">{s.label}</div>
                  <ul className="flex flex-col gap-3">
                    {Array.isArray(s.data) ? s.data.map((item, i) => (
                      <li key={i}><span className="w-2 h-2 rounded-full shrink-0 mt-1.5 bg-zinc-500" />{item}</li>
                    )) : null}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Live news panel — headlines from Finnhub for the analyzed symbol */}
          <div className="lg:col-span-2">
            <NewsPanel symbol={symbol} />
          </div>

        </div>
      </div>

      {/* Follow-up query input */}
      <div className="px-8 py-6 flex flex-col items-center bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800 z-10">
        <ChatInput
          value={q}
          onChange={setQ}
          onSubmit={() => { if (q.trim()) onNewQuery(q.trim()); }}
          loading={false}
          placeholder="Ask follow-up or analyze another company…"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SavedReportsView
// Lists all investment reports saved by the authenticated user.
// Each card supports: re-analyze, PDF download, and delete.
// PDF is fetched as a blob via authFetch to correctly attach the Bearer token.
// ---------------------------------------------------------------------------

function SavedReportsView({ onAnalyze }) {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get('/api/reports')
      .then(r => r.data)
      .then(data => setReports(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const handleDelete = async (id) => {
    await api.delete(`/api/reports/${id}`);
    setReports(prev => prev.filter(r => r.id !== id));
  };

  /**
   * Downloads a report as a PDF by fetching it via api (to attach the
   * Bearer token) and triggering a browser download via a temporary object URL.
   */
  const handlePdf = async (id, ticker) => {
    try {
      const r = await api.get(`/api/reports/${id}/pdf`, { responseType: 'blob' });
      const blob = r.data;
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${ticker}_Research_Report.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-400 text-center">
      <ReportsIco />
      <h3 className="font-heading text-xl text-white font-semibold">Sign in to view saved reports</h3>
      <p>Your research reports will appear here once you sign in.</p>
    </div>
  );

  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-zinc-950">
      <div className="w-12 h-12 rounded-full border-4 border-zinc-800 border-t-blue-500 animate-spin" />
      <p className="text-lg text-white font-medium tracking-wide flex items-center gap-1">Loading reports<span className="after:content-[''] after:animate-ping after:w-1 after:h-1 after:bg-white after:rounded-full after:ml-1 after:inline-block" /></p>
    </div>
  );

  if (!reports.length) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-400 text-center">
      <ReportsIco />
      <h3 className="font-heading text-xl text-white font-semibold">No saved reports yet</h3>
      <p>Analyze a company and click "Save Report" to store it here.</p>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-[1200px] mx-auto w-full animate-[fadeIn_0.4s_ease-out_forwards]">
      <div className="flex items-center justify-between mb-6 border-b border-zinc-800 pb-4">
        <h2 className="font-heading text-2xl font-semibold text-white">Saved Reports</h2>
        <span className="text-sm text-zinc-400 bg-white/5 px-3 py-1 rounded-full font-semibold">{reports.length} report{reports.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {reports.map(r => (
          <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex justify-between items-center hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-lg transition-all">
            <div className="flex flex-col gap-1">
              <div className="font-heading text-lg font-bold text-white tracking-wide">{r.ticker}</div>
              <div className="text-sm text-zinc-400">{r.companyName}</div>
              <div className="text-[11px] text-zinc-500 uppercase tracking-wide mt-1">
                {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div
                className={`font-heading font-bold rounded-xl border-2 shadow-sm text-xs px-3 py-1 ${r.recommendation === 'BUY' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500' : r.recommendation === 'PASS' ? 'bg-red-500/10 text-red-500 border-red-500' : 'bg-amber-500/10 text-amber-500 border-amber-500'}`}
              >
                {r.recommendation}
              </div>
              <div className="font-heading text-2xl font-bold text-white">{r.score}/100</div>
              <div className="flex gap-2">
                <button className="inline-flex items-center justify-center p-2 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:text-white hover:border-zinc-400 transition-all" title="Re-analyze" onClick={() => onAnalyze(r.ticker)}>
                  <SearchIco />
                </button>
                <button className="inline-flex items-center justify-center p-2 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:text-white hover:border-zinc-400 transition-all" title="Download PDF" onClick={() => handlePdf(r.id, r.ticker)}>
                  <PDFIco />
                </button>
                <button className="inline-flex items-center justify-center p-2 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-lg hover:bg-red-500/10 hover:text-red-500 hover:border-red-500 transition-all" title="Delete" onClick={() => handleDelete(r.id)}>
                  <TrashIco />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WatchlistView
// Displays stocks the user has bookmarked for quick re-analysis.
// ---------------------------------------------------------------------------

function WatchlistView({ onAnalyze }) {
  const { user } = useAuth();
  const [list, setList]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get('/api/watchlist')
      .then(r => r.data)
      .then(data => setList(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const remove = async (symbol) => {
    await api.delete(`/api/watchlist/${symbol}`);
    setList(prev => prev.filter(w => w.symbol !== symbol));
  };

  if (!user) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-400 text-center">
      <WatchIco />
      <h3 className="font-heading text-xl text-white font-semibold">Sign in to use your watchlist</h3>
      <p>Track your favourite stocks by adding them to your watchlist.</p>
    </div>
  );

  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-zinc-950">
      <div className="w-12 h-12 rounded-full border-4 border-zinc-800 border-t-blue-500 animate-spin" />
      <p className="text-lg text-white font-medium tracking-wide flex items-center gap-1">Loading watchlist<span className="after:content-[''] after:animate-ping after:w-1 after:h-1 after:bg-white after:rounded-full after:ml-1 after:inline-block" /></p>
    </div>
  );

  if (!list.length) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-400 text-center">
      <WatchIco />
      <h3 className="font-heading text-xl text-white font-semibold">Your watchlist is empty</h3>
      <p>Analyze a company and click "Watch" to add it here.</p>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-[1200px] mx-auto w-full animate-[fadeIn_0.4s_ease-out_forwards]">
      <div className="flex items-center justify-between mb-6 border-b border-zinc-800 pb-4">
        <h2 className="font-heading text-2xl font-semibold text-white">Watchlist</h2>
        <span className="text-sm text-zinc-400 bg-white/5 px-3 py-1 rounded-full font-semibold">{list.length} stock{list.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {list.map(w => (
          <div key={w.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex justify-between items-center hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-lg transition-all">
            <div>
              <div className="font-heading text-lg font-bold text-white tracking-wide">{w.symbol}</div>
              <div className="text-sm text-zinc-400">{w.companyName}</div>
              <div className="text-[11px] text-zinc-500 uppercase tracking-wide mt-1">Added {new Date(w.addedAt).toLocaleDateString()}</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="inline-flex items-center justify-center p-2 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:text-white hover:border-zinc-400 transition-all" title="Analyze" onClick={() => onAnalyze(w.symbol)}>
                <SearchIco />
              </button>
              <button className="inline-flex items-center justify-center p-2 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-lg hover:bg-red-500/10 hover:text-red-500 hover:border-red-500 transition-all" title="Remove" onClick={() => remove(w.symbol)}>
                <TrashIco />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


/** Shown when the analysis API returns an error. */
function ErrorBox({ msg, onBack }) {
  return (
    <div className="flex-1 flex flex-col items-center pt-16 gap-6">
      <div className="bg-red-500/10 border border-red-500 rounded-2xl p-5 text-red-400 text-base" style={{ maxWidth: 560 }}>
        ⚠ {typeof msg === 'string' ? msg : JSON.stringify(msg)}
      </div>
      <button className="inline-flex items-center justify-center gap-1.5 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-xl py-2 px-5 text-sm font-medium cursor-pointer hover:bg-zinc-800 hover:text-white hover:border-zinc-500 transition-all" onClick={onBack}><BackIco /> Go back</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppInner — Main State Controller
// Manages the active view, analysis lifecycle, and auth modal visibility.
// URL search params keep the last analyzed symbol shareable/bookmarkable.
// ---------------------------------------------------------------------------

function AnalyzeRoute() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!symbol) return;
    setLoading(true); setError(''); setData(null);
    api.post('/api/analyze', { query: symbol })
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, [symbol]);

  const handleBack = () => navigate('/');
  const handleNewQuery = (q) => navigate(`/analyze/${q}`);

  if (loading) return <LoadingView query={symbol} />;
  if (error) return <ErrorBox msg={error} onBack={handleBack} />;
  if (data) return <ResultsView data={data} symbol={symbol} onBack={handleBack} onNewQuery={handleNewQuery} />;
  return null;
}

function AppInner() {
  const [showAuth, setShowAuth] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleAnalyze = (q) => {
    if (q.trim()) navigate(`/analyze/${q.trim()}`);
  };

  return (
    <div className="flex h-screen w-screen relative overflow-hidden bg-zinc-950">
      <Sidebar
        onAuthClick={() => setShowAuth(true)}
        onLogout={logout}
      />

      <div className="flex-1 flex flex-col relative overflow-hidden z-[1]">
        <Topbar onAuthClick={() => setShowAuth(true)} />

        <Routes>
          <Route path="/" element={<HomeView onAnalyze={handleAnalyze} />} />
          <Route path="/analyze/:symbol" element={<AnalyzeRoute />} />
          <Route path="/reports" element={<SavedReportsView onAnalyze={handleAnalyze} />} />
          <Route path="/watchlist" element={<WatchlistView onAnalyze={handleAnalyze} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}

/**
 * Root component. Wraps the entire app with AuthProvider so that any
 * component can access the user session via useAuth().
 */
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
