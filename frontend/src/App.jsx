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
import { useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthModal from './components/AuthModal';
import { ScoreRadar, MetricsBar, CompareBar } from './components/Charts';
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
const CompareIco = () => <Icon d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />;
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

function Sidebar({ view, setView, onAuthClick, onLogout }) {
  const { user } = useAuth();

  const navItems = [
    { id: 'home',    Icon: HomeIco,    label: 'Home' },
    { id: 'reports', Icon: ReportsIco, label: 'Saved Reports' },
    { id: 'watch',   Icon: WatchIco,   label: 'Watchlist' },
    { id: 'compare', Icon: CompareIco, label: 'Compare' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">AI</div>
      <nav className="sidebar-nav">
        {navItems.map(({ id, Icon: I, label }) => (
          <button
            key={id}
            title={label}
            className={`nav-btn ${view === id ? 'active' : ''}`}
            onClick={() => setView(id)}
          >
            <I />
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button
          className="nav-btn"
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
    <div className="topbar">
      {user ? (
        <div className="user-badge" onClick={logout} title="Click to sign out">
          <div className="user-avatar">{user.name?.[0]?.toUpperCase() || 'U'}</div>
          <span className="user-name">{user.name}</span>
          <ChevDown />
        </div>
      ) : (
        <button className="user-badge" onClick={onAuthClick} style={{ cursor: 'pointer' }}>
          <div className="user-avatar" style={{ background: 'rgba(255,255,255,0.1)' }}>?</div>
          <span className="user-name">Sign In</span>
          <ChevDown />
        </button>
      )}
    </div>
  );
}

/** Decorative animated orb displayed on the home screen. */
const AIOrb = () => (
  <div className="orb-container">
    <div className="orb" />
  </div>
);

// ---------------------------------------------------------------------------
// ChatInput
// Shared text input component used on the home screen and the results view.
// Submits on Enter (Shift+Enter inserts a newline).
// ---------------------------------------------------------------------------

function ChatInput({ value, onChange, onSubmit, loading, placeholder = 'Ask me anything.......' }) {
  const ref = useRef(null);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="chat-input-box">
      <div className="input-top">
        <span className="sparkle-icon"><SparkIco /></span>
        <textarea
          ref={ref}
          rows={1}
          className="chat-textarea"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
        />
      </div>
      <div className="input-bottom">
        <button
          className="send-btn"
          onClick={onSubmit}
          disabled={!value.trim() || loading}
        >
          <SendIco />
        </button>
      </div>
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

  const quickPrompts = [
    'Analyze AAPL',
    'Research TSLA fundamentals',
    'MSFT investment thesis',
    'NVDA growth prospects',
  ];

  const cards = [
    { tag: 'Research',      cls: 'teal',   desc: 'Analyze any stock or company ticker' },
    { tag: 'Compare',       cls: 'pink',   desc: 'Compare two companies side by side' },
    { tag: 'Market Trends', cls: 'yellow', desc: 'Get sector & market overviews' },
  ];

  return (
    <div className="home-screen">
      <AIOrb />
      <div className="greeting">
        <h1>Hey! Researcher<br />What can I help with?</h1>
      </div>
      <div className="quick-actions">
        {cards.map((c, i) => (
          <div key={i} className="action-card" onClick={() => setQ(`${c.tag}: `)}>
            <span className={`action-tag ${c.cls}`}>{c.tag}</span>
            <p className="action-desc">{c.desc}</p>
          </div>
        ))}
      </div>
      <ChatInput
        value={q}
        onChange={setQ}
        onSubmit={() => { if (q.trim()) onAnalyze(q.trim()); }}
        loading={loading}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14, maxWidth: 620, width: '100%' }}>
        {quickPrompts.map((p, i) => (
          <button key={i} className="pill-btn" onClick={() => onAnalyze(p)}>{p}</button>
        ))}
      </div>
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
    <div className="loading-screen">
      <div className="loading-orb" />
      <p className="loading-text">
        Analyzing <strong style={{ color: 'var(--accent-teal)' }}>{query?.toUpperCase()}</strong>
        <span className="loading-dots" />
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
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
  const { user, authFetch } = useAuth();
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
      await authFetch('http://localhost:5000/api/reports/save', {
        method: 'POST',
        body: JSON.stringify({
          ticker:         symbol,
          companyName:    data.companyOverview?.name || symbol,
          recommendation: data.recommendation,
          score:          data.investmentScore?.overallScore || 0,
          reasoning:      data.reasoning,
          financialData:  data.financialAnalysis,
          swot:           data.swotAnalysis,
          fullReport:     data,
        }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  /** Adds the current stock to the user's watchlist. */
  const addWatch = async () => {
    if (!user) { alert('Sign in to use watchlist'); return; }
    await authFetch('http://localhost:5000/api/watchlist', {
      method: 'POST',
      body: JSON.stringify({ symbol, companyName: data.companyOverview?.name || symbol }),
    });
    setWatched(true);
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
    <div className="results-screen">
      <div className="results-wrapper animate-in">

        {/* Navigation and action toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
          <button className="back-btn" onClick={onBack}><BackIco /> Back to home</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`action-icon-btn ${watched ? 'active-teal' : ''}`}
              onClick={addWatch}
              title="Add to watchlist"
            >
              <WatchIco /> {watched ? 'Watching' : 'Watch'}
            </button>
            <button
              className={`action-icon-btn ${saved ? 'active-teal' : ''}`}
              onClick={saveReport}
              disabled={saving}
              title="Save report"
            >
              <SaveIco /> {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Report'}
            </button>
          </div>
        </div>

        {/* Company header and recommendation */}
        <div className="result-header">
          <div>
            <div className="result-company">{data.companyOverview?.name || symbol.toUpperCase()}</div>
            <div className="result-badges" style={{ marginTop: 8 }}>
              <span className="badge badge-blue">{symbol.toUpperCase()}</span>
              {data.dataSource && (
                <span className={`badge ${data.dataSource.includes('Real') ? 'badge-green' : 'badge-amber'}`}>
                  {data.dataSource.includes('Real') ? '📡 Live Data' : '🧠 AI Knowledge Base'}
                </span>
              )}
            </div>
          </div>
          <div className="recommendation-box">
            <div className="rec-label">Recommendation</div>
            <div className={`rec-value ${recCls}`}>{data.recommendation || 'HOLD'}</div>
          </div>
        </div>

        {/* Score summary cards */}
        <div className="scores-grid">
          {scores.map((s, i) => (
            <div key={i} className="score-card">
              <div className="score-label">{s.label}</div>
              <div className="score-value">{s.value ?? '--'}</div>
            </div>
          ))}
        </div>

        {/* Recharts visualisations */}
        <div className="charts-row">
          <ScoreRadar scores={data.investmentScore} />
          <MetricsBar financialAnalysis={data.financialAnalysis} />
        </div>

        {/* Detail panels */}
        <div className="panels-grid">

          {/* Investment thesis and confidence */}
          <div className="panel">
            <div className="panel-title">⚡ Investment Thesis</div>
            <p className="thesis-text">{data.reasoning || 'No reasoning available.'}</p>
            <div className="confidence-block">
              <span className="confidence-label">Confidence: </span>
              <span className="confidence-value">{data.confidenceLevel || 'Medium'}</span>
              {data.confidenceExplanation && (
                <p className="confidence-note">{data.confidenceExplanation}</p>
              )}
            </div>
          </div>

          {/* Key financial metrics */}
          <div className="panel">
            <div className="panel-title">📊 Financial Overview</div>
            <div className="metrics-grid">
              {metrics.map((m, i) => (
                <div key={i} className="metric-item">
                  <div className="metric-label">{m.label}</div>
                  <div className="metric-value">{m.value || '--'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SWOT analysis grid */}
          <div className="panel full">
            <div className="panel-title">SWOT Analysis</div>
            <div className="swot-grid">
              {swotSections.map(s => (
                <div key={s.key} className={`swot-item ${s.cls}`}>
                  <div className="swot-heading">{s.label}</div>
                  <ul className="swot-list">
                    {s.data.map((item, i) => (
                      <li key={i}><span className="swot-dot" />{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Live news panel (Finnhub) */}
          <div className="full">
            <NewsPanel symbol={symbol} />
          </div>

        </div>
      </div>

      {/* Follow-up query input */}
      <div className="results-input-area">
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
  const { authFetch } = useAuth();
  const { user }      = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    authFetch('http://localhost:5000/api/reports')
      .then(r => r.json())
      .then(d => setReports(Array.isArray(d) ? d : []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [user]);

  const remove = async (id) => {
    await authFetch(`http://localhost:5000/api/reports/${id}`, { method: 'DELETE' });
    setReports(prev => prev.filter(r => r.id !== id));
  };

  /**
   * Downloads a report as a PDF by fetching it via authFetch (to attach the
   * Bearer token) and triggering a browser download via a temporary object URL.
   */
  const downloadPDF = async (id, ticker) => {
    const r    = await authFetch(`http://localhost:5000/api/reports/${id}/pdf`);
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${ticker}-report.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!user) return (
    <div className="empty-view">
      <ReportsIco />
      <h3>Sign in to view saved reports</h3>
      <p>Your research reports will appear here once you sign in.</p>
    </div>
  );

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-orb" />
      <p className="loading-text">Loading reports<span className="loading-dots" /></p>
    </div>
  );

  if (!reports.length) return (
    <div className="empty-view">
      <ReportsIco />
      <h3>No saved reports yet</h3>
      <p>Analyze a company and click "Save Report" to store it here.</p>
    </div>
  );

  return (
    <div className="list-view animate-in">
      <div className="list-view-header">
        <h2 className="list-view-title">Saved Reports</h2>
        <span className="list-view-count">{reports.length} report{reports.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="report-list">
        {reports.map(r => (
          <div key={r.id} className="report-card">
            <div className="report-card-left">
              <div className="report-ticker">{r.ticker}</div>
              <div className="report-company">{r.companyName}</div>
              <div className="report-date">
                {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div className="report-card-right">
              <div
                className={`rec-badge ${r.recommendation === 'BUY' ? 'rec-buy' : r.recommendation === 'PASS' ? 'rec-sell' : 'rec-hold'}`}
                style={{ fontSize: 11, padding: '3px 10px' }}
              >
                {r.recommendation}
              </div>
              <div className="report-score">{r.score}/100</div>
              <div className="report-actions">
                <button className="icon-action-btn" title="Re-analyze" onClick={() => onAnalyze(r.ticker)}>
                  <SearchIco />
                </button>
                <button className="icon-action-btn" title="Download PDF" onClick={() => downloadPDF(r.id, r.ticker)}>
                  <PDFIco />
                </button>
                <button className="icon-action-btn danger" title="Delete" onClick={() => remove(r.id)}>
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
  const { user, authFetch } = useAuth();
  const [list, setList]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    authFetch('http://localhost:5000/api/watchlist')
      .then(r => r.json())
      .then(d => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [user]);

  const remove = async (symbol) => {
    await authFetch(`http://localhost:5000/api/watchlist/${symbol}`, { method: 'DELETE' });
    setList(prev => prev.filter(w => w.symbol !== symbol));
  };

  if (!user) return (
    <div className="empty-view">
      <WatchIco />
      <h3>Sign in to use your watchlist</h3>
      <p>Track your favourite stocks by adding them to your watchlist.</p>
    </div>
  );

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-orb" />
      <p className="loading-text">Loading watchlist<span className="loading-dots" /></p>
    </div>
  );

  if (!list.length) return (
    <div className="empty-view">
      <WatchIco />
      <h3>Your watchlist is empty</h3>
      <p>Analyze a company and click "Watch" to add it here.</p>
    </div>
  );

  return (
    <div className="list-view animate-in">
      <div className="list-view-header">
        <h2 className="list-view-title">Watchlist</h2>
        <span className="list-view-count">{list.length} stock{list.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="watch-grid">
        {list.map(w => (
          <div key={w.id} className="watch-card">
            <div>
              <div className="watch-symbol">{w.symbol}</div>
              <div className="watch-name">{w.companyName}</div>
              <div className="watch-date">Added {new Date(w.addedAt).toLocaleDateString()}</div>
            </div>
            <div className="watch-actions">
              <button className="icon-action-btn" title="Analyze" onClick={() => onAnalyze(w.symbol)}>
                <SearchIco />
              </button>
              <button className="icon-action-btn danger" title="Remove" onClick={() => remove(w.symbol)}>
                <TrashIco />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompareView
// Accepts two stock tickers and calls POST /api/compare to get a side-by-side
// investment comparison from Gemini, displayed with score cards and a bar chart.
// ---------------------------------------------------------------------------

function CompareView() {
  const [s1, setS1]           = useState('');
  const [s2, setS2]           = useState('');
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const compare = async () => {
    if (!s1.trim() || !s2.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await fetch('http://localhost:5000/api/compare', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ symbol1: s1.trim(), symbol2: s2.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="list-view animate-in">
      <div className="list-view-header">
        <h2 className="list-view-title">Compare Companies</h2>
      </div>

      <div className="compare-inputs">
        <input className="compare-input" placeholder="Symbol 1 (e.g. AAPL)" value={s1} onChange={e => setS1(e.target.value)} />
        <span className="compare-vs">VS</span>
        <input className="compare-input" placeholder="Symbol 2 (e.g. MSFT)" value={s2} onChange={e => setS2(e.target.value)} />
        <button
          className="send-btn"
          style={{ width: 44, height: 44 }}
          onClick={compare}
          disabled={loading || !s1.trim() || !s2.trim()}
        >
          {loading ? <span style={{ fontSize: 10 }}>…</span> : <SendIco />}
        </button>
      </div>

      {error && <div className="error-box">⚠ {error}</div>}

      {loading && (
        <div className="loading-screen" style={{ flex: 'unset', paddingTop: 40 }}>
          <div className="loading-orb" />
          <p className="loading-text">Comparing<span className="loading-dots" /></p>
        </div>
      )}

      {result && !loading && (
        <div className="animate-in" style={{ marginTop: 24 }}>

          {/* Winner declaration banner */}
          <div className="winner-banner">
            🏆 Better Investment: <strong style={{ color: 'var(--accent-teal)' }}>{result.winner}</strong>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, fontWeight: 400 }}>
              {result.winnerReason}
            </p>
          </div>

          {/* Side-by-side company cards */}
          <div className="compare-cards">
            {[result.company1, result.company2].map((c, i) => (
              <div key={i} className={`compare-company-card ${c?.symbol === result.winner ? 'winner' : ''}`}>
                {c?.symbol === result.winner && <div className="winner-badge">🏆 Winner</div>}
                <div className="compare-symbol">{c?.symbol}</div>
                <div className="compare-name">{c?.name}</div>
                <div className="compare-score-big">
                  {c?.score}<span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/100</span>
                </div>
                <div
                  className={`rec-value ${c?.recommendation === 'BUY' ? 'rec-buy' : c?.recommendation === 'PASS' ? 'rec-sell' : 'rec-hold'}`}
                  style={{ fontSize: 13, padding: '4px 14px', marginBottom: 14 }}
                >
                  {c?.recommendation}
                </div>
                {c?.strengths?.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--accent-teal)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 }}>
                      Strengths
                    </div>
                    <ul className="swot-list" style={{ marginBottom: 10 }}>
                      {c.strengths.map((s, j) => (
                        <li key={j}><span className="swot-dot" style={{ background: 'var(--accent-teal)' }} />{s}</li>
                      ))}
                    </ul>
                  </>
                )}
                {c?.weaknesses?.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: '#f87171', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 }}>
                      Weaknesses
                    </div>
                    <ul className="swot-list">
                      {c.weaknesses.map((w, j) => (
                        <li key={j}><span className="swot-dot" style={{ background: '#f87171' }} />{w}</li>
                      ))}
                    </ul>
                  </>
                )}
                {c?.metrics && (
                  <div className="compare-metrics">
                    {Object.entries(c.metrics).map(([k, v]) => (
                      <div key={k} className="compare-metric"><span>{k}</span><strong>{v}</strong></div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Score comparison bar chart */}
          {result.company1 && result.company2 && (
            <CompareBar company1={result.company1} company2={result.company2} />
          )}
        </div>
      )}
    </div>
  );
}

/** Shown when the analysis API returns an error. */
function ErrorBox({ msg, onBack }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, gap: 16 }}>
      <div className="error-box" style={{ maxWidth: 560 }}>⚠ {msg}</div>
      <button className="back-btn" onClick={onBack}><BackIco /> Go back</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppInner — Main State Controller
// Manages the active view, analysis lifecycle, and auth modal visibility.
// URL search params keep the last analyzed symbol shareable/bookmarkable.
// ---------------------------------------------------------------------------

function AppInner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView]     = useState('home');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [data, setData]     = useState(null);
  const [symbol, setSymbol] = useState(searchParams.get('symbol') || '');
  const [showAuth, setShowAuth] = useState(false);
  const { logout }          = useAuth();

  /**
   * Sends a query to the backend analysis endpoint and updates state.
   * Switches back to the home view to display loading/results.
   */
  const analyze = async (q) => {
    const target = q.trim();
    if (!target) return;
    setSymbol(target);
    setSearchParams({ symbol: target });
    setView('home');
    setLoading(true); setError(''); setData(null);
    try {
      const r = await fetch('http://localhost:5000/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: target }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Analysis failed');
      setData(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-analyze if a symbol is present in the URL on first load
  useEffect(() => {
    const s = searchParams.get('symbol');
    if (s) analyze(s);
  }, []);

  const handleBack = () => {
    setData(null); setError(''); setSymbol(''); setSearchParams({});
  };

  const handleViewChange = (v) => {
    setView(v);
    // Clear results when navigating away from the home view
    if (v !== 'home') { setData(null); setError(''); }
  };

  return (
    <div className="app-shell">
      <div className="grid-bg" />
      <Sidebar
        view={view}
        setView={handleViewChange}
        onAuthClick={() => setShowAuth(true)}
        onLogout={logout}
      />

      <div className="main-content">
        <Topbar onAuthClick={() => setShowAuth(true)} />

        {/* Conditional view rendering based on state */}
        {view === 'home' && loading   && <LoadingView query={symbol} />}
        {view === 'home' && !loading  && error   && <ErrorBox msg={error} onBack={handleBack} />}
        {view === 'home' && !loading  && !error  && !data && <HomeView onAnalyze={analyze} loading={loading} />}
        {view === 'home' && !loading  && !error  && data  && (
          <ResultsView
            data={data}
            symbol={symbol}
            onBack={handleBack}
            onNewQuery={q => { handleBack(); setTimeout(() => analyze(q), 50); }}
          />
        )}

        {view === 'reports' && <SavedReportsView onAnalyze={q => { setView('home'); analyze(q); }} />}
        {view === 'watch'   && <WatchlistView    onAnalyze={q => { setView('home'); analyze(q); }} />}
        {view === 'compare' && <CompareView />}
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
