/**
 * @file Charts.jsx
 * @description Recharts visualisation components used in the results view.
 *
 * Exports:
 *   - ScoreRadar  — Radar chart of the five investment score dimensions
 *   - MetricsBar  — Horizontal bar chart for key financial metrics
 */

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';

// Design tokens — keep consistent with index.css accent colours
const COLOR_PRIMARY = 'var(--color-surface-strong)';
const COLOR_SECONDARY = 'var(--color-text-secondary)';
const COLOR_MUTED = 'var(--color-text-inverse)';

/** Shared tooltip style to match the light UI theme. */
const tooltipStyle = {
  backgroundColor: 'var(--color-surface-muted)',
  border:          '1px solid var(--color-border-default)',
  borderRadius:    'var(--radius-sm)',
  color:           'var(--color-text-primary)',
  fontSize:        'var(--font-size-xs)',
  boxShadow:       'var(--shadow-1)'
};

/**
 * ScoreRadar
 * Renders a radar chart plotting five investment score dimensions:
 * Overall, Growth, Financial Health, Risk, and Valuation.
 *
 * @param {{ overallScore, growthScore, financialHealth, riskScore, valuationScore }} scores
 */
export function ScoreRadar({ scores }) {
  if (!scores) return null;

  const data = [
    { subject: 'Growth',    value: scores.growthScore     || 0 },
    { subject: 'Health',    value: scores.financialHealth || 0 },
    { subject: 'Risk',      value: scores.riskScore       || 0 },
    { subject: 'Valuation', value: scores.valuationScore  || 0 },
    { subject: 'Overall',   value: scores.overallScore    || 0 },
  ];

  return (
    <div className="chart-wrapper">
      <h4 className="chart-title">Investment Scores</h4>
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
          <PolarGrid stroke="var(--color-border-default)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: COLOR_MUTED, fontSize: 11 }} />
          <Radar
            dataKey="value"
            stroke={COLOR_PRIMARY}
            fill={COLOR_PRIMARY}
            fillOpacity={0.18}
            dot={{ fill: COLOR_PRIMARY, r: 3 }}
          />
          <Tooltip contentStyle={tooltipStyle} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * MetricsBar
 * Renders a vertical bar chart for key financial metrics (P/E, ROE, margin, growth).
 * Strips non-numeric characters before parsing so values like "28.5x" or "12%" work.
 *
 * @param {{ peRatio, roe, operatingMargin, revenueGrowth }} financialAnalysis
 */
export function MetricsBar({ financialAnalysis }) {
  if (!financialAnalysis) return null;

  const parseNum = (val) => {
    if (val === null || val === undefined || val === 'N/A' || val === '--') return null;
    return parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  };

  const data = [
    { name: 'P/E',           value: parseNum(financialAnalysis.peRatio),         raw: financialAnalysis.peRatio },
    { name: 'ROE %',         value: parseNum(financialAnalysis.roe),              raw: financialAnalysis.roe },
    { name: 'Op. Margin %',  value: parseNum(financialAnalysis.operatingMargin),  raw: financialAnalysis.operatingMargin },
    { name: 'Rev. Growth %', value: parseNum(financialAnalysis.revenueGrowth),    raw: financialAnalysis.revenueGrowth },
  ].filter(d => d.value !== null && !isNaN(d.value));

  if (!data.length) return null;

  return (
    <div className="chart-wrapper">
      <h4 className="chart-title">Key Metrics</h4>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" />
          <XAxis dataKey="name" tick={{ fill: COLOR_MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: COLOR_MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(_, __, props) => [props.payload.raw, 'Value']}
          />
          <Bar dataKey="value" fill={COLOR_PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

