import React from 'react';

const SWOTGrid = ({ swot }) => {
  return (
    <div className="card">
      <h3>SWOT Analysis</h3>
      <div className="swot-grid">
        <div className="swot-section strengths">
          <h4>Strengths</h4>
          <ul>
            {swot.strengths.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="swot-section weaknesses">
          <h4>Weaknesses</h4>
          <ul>
            {swot.weaknesses.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="swot-section opportunities">
          <h4>Opportunities</h4>
          <ul>
            {swot.opportunities.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="swot-section threats">
          <h4>Threats</h4>
          <ul>
            {swot.threats.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SWOTGrid;
