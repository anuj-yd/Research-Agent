import React from 'react';

const ScoreCard = ({ score }) => {
  return (
    <div className="card">
      <h3>Investment Score</h3>
      <div className="score-value">{score}/100</div>
      <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
        Based on our comprehensive AI analysis.
      </p>
    </div>
  );
};

export default ScoreCard;
