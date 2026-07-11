/**
 * @file NewsPanel.jsx
 * @description Fetches and renders the latest company news headlines from the
 * backend (/api/news/:symbol), which sources them from Finnhub.
 * Displays up to 5 articles in a responsive card grid, with a relative
 * timestamp and a direct link to the original source.
 *
 * @prop {string} symbol - The stock ticker to fetch news for (e.g. "AAPL")
 */

import React, { useState, useEffect } from 'react';
import api from '../api';

/** Converts an ISO timestamp to a short human-readable age string (e.g. "3h ago"). */
function timeSince(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours  = Math.floor(diffMs / 3_600_000);
  const days   = Math.floor(hours / 24);
  if (days  > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return 'just now';
}

/** Shared panel shell used for loading and empty states. */
function PanelShell({ children }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-md">
      <div className="font-heading text-xl font-semibold text-white mb-4 flex items-center gap-2">
        📰 Latest News
      </div>
      {children}
    </div>
  );
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
      <PanelShell>
        <p className="text-sm text-zinc-400 py-4">Fetching latest news…</p>
      </PanelShell>
    );
  }

  if (!news.length) {
    return (
      <PanelShell>
        <p className="text-sm text-zinc-400">No recent news found for this symbol.</p>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {news.map((item, i) => (
          <a
            key={i}
            href={item.url || '#'}
            target={item.url ? '_blank' : undefined}
            rel={item.url ? 'noopener noreferrer' : undefined}
            className="flex flex-col p-5 rounded-2xl border border-zinc-800 bg-zinc-950 no-underline transition-all hover:border-blue-500 hover:-translate-y-1 hover:shadow-lg"
            style={{ cursor: item.url ? 'pointer' : 'default' }}
          >
            {/* Source and timestamp row */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wide bg-blue-500/10 px-2 py-0.5 rounded-full">
                {item.source}
                {item.isAIGenerated && (
                  <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-sm">
                    ✨ AI Generated
                  </span>
                )}
              </span>
              <span className="text-xs text-zinc-500">{timeSince(item.datetime)}</span>
            </div>

            {/* Headline */}
            <p className="text-base text-white font-semibold mb-2 leading-snug">{item.headline}</p>

            {/* Optional summary excerpt */}
            {item.summary && (
              <p className="text-sm text-zinc-400 leading-relaxed flex-1">{item.summary}</p>
            )}
          </a>
        ))}
      </div>
    </PanelShell>
  );
}
