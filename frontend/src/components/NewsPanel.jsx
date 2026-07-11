/**
 * @file NewsPanel.jsx
 * @description Fetches and displays the latest company news from the backend
 * (sourced from Finnhub). Each article links out to the original source.
 *
 * @prop {string} symbol - Stock ticker whose news should be fetched (e.g. "AAPL")
 */

import React, { useState, useEffect } from 'react';
import api from '../api';

/** Converts an ISO timestamp to a human-readable relative time (e.g. "3h ago"). */
function timeSince(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours  = Math.floor(diffMs / 3_600_000);
  const days   = Math.floor(hours / 24);
  if (days  > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return 'just now';
}

export default function NewsPanel({ symbol }) {
  const [news, setNews]       = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    api.get(`/api/news/${symbol.toUpperCase()}`)
      .then(r => setNews(r.data.slice(0, 5)))
      .catch(err => console.error(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-title">📰 Latest News</div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', padding: 'var(--space-6) 0' }}>
          Fetching news<span className="loading-dots" />
        </div>
      </div>
    );
  }

  if (!news.length) {
    return (
      <div className="panel">
        <div className="panel-title">📰 Latest News</div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          No recent news found for this symbol.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-title">📰 Latest News</div>
      <div className="news-list">
        {news.map((item, i) => (
          <a
            key={i}
            href={item.url || '#'}
            target={item.url ? '_blank' : undefined}
            rel={item.url ? 'noopener noreferrer' : undefined}
            className={`news-item ${item.isAIGenerated ? 'ai-generated' : ''}`}
            style={{ cursor: item.url ? 'pointer' : 'default' }}
          >
            <div className="news-meta">
              <span className="news-source">
                {item.source}
                {item.isAIGenerated && <span className="ai-badge" style={{ marginLeft: 'var(--space-4)', fontSize: 'var(--font-size-xs)', background: 'var(--color-surface-strong)', color: 'var(--color-surface-base)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-xs)' }}>✨ AI Generated</span>}
              </span>
              <span className="news-time">{timeSince(item.datetime)}</span>
            </div>
            <p className="news-headline">{item.headline}</p>
            {item.summary && <p className="news-summary">{item.summary}</p>}
          </a>
        ))}
      </div>
    </div>
  );
}
