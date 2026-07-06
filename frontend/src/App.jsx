import React from 'react';
import './App.css';
import ScoreCard from './components/ScoreCard';
import SWOTGrid from './components/SWOTGrid';

function App() {
  const dummyData = {
    score: 85,
    swot: {
      strengths: ['Strong brand presence', 'High revenue growth'],
      weaknesses: ['Dependency on a single product', 'High operational costs'],
      opportunities: ['Expansion into emerging markets', 'New AI technologies'],
      threats: ['Aggressive competition', 'Regulatory changes']
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Research Agent Dashboard</h1>
        <p>AI-Powered Investment Analysis</p>
      </header>
      
      <main>
        <div className="grid-layout">
          <ScoreCard score={dummyData.score} />
          <SWOTGrid swot={dummyData.swot} />
        </div>
      </main>
    </div>
  );
}

export default App;
