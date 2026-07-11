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
    <aside className="sidebar">
      <div className="sidebar-logo">AI</div>
      <nav className="sidebar-nav">
        {navItems.map(({ id, path, Icon: I, label }) => (
          <button
            key={id}
            title={label}
            className={`nav-btn ${activeId === id ? 'active' : ''}`}
            onClick={() => navigate(path)}
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
          <div className="user-avatar">?</div>
          <span className="user-name">Sign In</span>
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
    { tag: 'Market Trends', cls: 'yellow', desc: 'Get sector & market overviews' },
  ];

  return (
    <div className="home-screen">
      <div className="greeting">
        <h1>Hey! Researcher<br />What can I help with?</h1>
      </div>
      <div className="quick-actions">
        {cards.map((c, i) => (
          <div key={i} className="action-card" onClick={() => setQ(`${c.tag}: `)}>
            <span className="action-tag">{c.tag}</span>
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
      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center', marginTop: 'var(--space-6)', maxWidth: 620, width: '100%' }}>
        {quickPrompts.map((p, i) => (
          <button key={i} className="btn-secondary" onClick={() => onAnalyze(p)}>{p}</button>
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
        Analyzing <strong style={{ color: 'var(--color-surface-strong)' }}>{query?.toUpperCase()}</strong>
        <span className="loading-dots" />
      </p>
      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
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
    <div className="results-screen">
      <div className="results-wrapper animate-in">

        {/* Navigation and action toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-5)', marginBottom: 'var(--space-8)' }}>
          <button className="back-btn" onClick={onBack}><BackIco /> Back to home</button>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
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
            <div className="result-badges" style={{ marginTop: 'var(--space-4)' }}>
              <span className="badge badge-blue">{symbol.toUpperCase()}</span>
              {typeof data.dataSource === 'string' && (
                <span className={`badge ${data.dataSource.includes('Real') ? 'badge-green' : 'badge-amber'}`}>
                  {data.dataSource.includes('Real') ? '📡 Live Data' : '🧠 AI Knowledge Base'}
                </span>
              )}
              {data.cached && (
                <span className="badge badge-purple" title="Report retrieved from cache (generated within last 24h)">
                  ⚡ Cached Report
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

          {/* News Sentiment Panel — derived from Finnhub + Gemini current affairs */}
          {data.newsSentiment && (
            <div className="panel">
              <div className="panel-title">📡 News Sentiment</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                <span
                  className={`rec-value ${
                    data.newsSentiment.sentiment === 'Bullish' ? 'rec-buy'
                    : data.newsSentiment.sentiment === 'Bearish' ? 'rec-sell'
                    : 'rec-hold'
                  }`}
                  style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-2) var(--space-7)' }}
                >
                  {data.newsSentiment.sentiment === 'Bullish' ? '📈 ' : data.newsSentiment.sentiment === 'Bearish' ? '📉 ' : '➡️ '}
                  {data.newsSentiment.sentiment}
                </span>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, flex: 1 }}>
                  {data.newsSentiment.newsImpact}
                </p>
              </div>
              {Array.isArray(data.newsSentiment.keyHeadlines) && data.newsSentiment.keyHeadlines.length > 0 && (
                <ul className="swot-list" style={{ marginTop: 'var(--space-4)' }}>
                  {data.newsSentiment.keyHeadlines.map((h, i) => (
                    <li key={i}><span className="swot-dot" style={{ background: 'var(--color-surface-strong)' }} />{h}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
                    {Array.isArray(s.data) ? s.data.map((item, i) => (
                      <li key={i}><span className="swot-dot" />{item}</li>
                    )) : null}
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
                style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-2) var(--space-5)' }}
              >
                {r.recommendation}
              </div>
              <div className="report-score">{r.score}/100</div>
              <div className="report-actions">
                <button className="icon-action-btn" title="Re-analyze" onClick={() => onAnalyze(r.ticker)}>
                  <SearchIco />
                </button>
                <button className="icon-action-btn" title="Download PDF" onClick={() => handlePdf(r.id, r.ticker)}>
                  <PDFIco />
                </button>
                <button className="icon-action-btn danger" title="Delete" onClick={() => handleDelete(r.id)}>
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


/** Shown when the analysis API returns an error. */
function ErrorBox({ msg, onBack }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, gap: 'var(--space-7)' }}>
      <div className="error-box" style={{ maxWidth: 560 }}>
        ⚠ {typeof msg === 'string' ? msg : JSON.stringify(msg)}
      </div>
      <button className="back-btn" onClick={onBack}><BackIco /> Go back</button>
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
    <div className="app-shell">
      <Sidebar
        onAuthClick={() => setShowAuth(true)}
        onLogout={logout}
      />

      <div className="main-content">
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
