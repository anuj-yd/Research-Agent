/**
 * @file NewsPanel.jsx
 * @description Fetches and displays the latest company news from the backend
 * (sourced from Finnhub). Each article links out to the original source.
 *
 * @prop {string} symbol - Stock ticker whose news should be fetched (e.g. "AAPL")
 */

import React, { useState, useEffect } from 'react';

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
    fetch(`http://localhost:5000/api/news/${symbol.toUpperCase()}`)
      .then(r => r.json())
      .then(d => setNews(Array.isArray(d) ? d : []))
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-title">📰 Latest News</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
          Fetching news<span className="loading-dots" />
        </div>
      </div>
    );
  }

  if (!news.length) {
    return (
      <div className="panel">
        <div className="panel-title">📰 Latest News</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
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
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="news-item"
          >
            <div className="news-meta">
              <span className="news-source">{item.source}</span>
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
