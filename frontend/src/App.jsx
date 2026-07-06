import React, { useState } from 'react';

function App() {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const analyzeCompany = async () => {
    if (!symbol.trim()) return;
    setLoading(true);
    setError('');
    setData(null);

    try {
      const response = await fetch(`http://localhost:5000/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: symbol.trim().toUpperCase() })
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch analysis');
      }
      
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950">
      <div className="max-w-6xl mx-auto px-4 py-12">
        
        {/* Header */}
        <header className="text-center mb-12 animate-fade-in-down">
          <h1 className="text-5xl font-extrabold tracking-tight mb-4 text-white">
            AI Investment <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Analyst</span>
          </h1>
          <p className="text-slate-400 text-lg">Enter a ticker symbol to get a CFA-level investment thesis.</p>
        </header>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-16">
          <input 
            type="text" 
            placeholder="e.g. AAPL, TSLA, MSFT" 
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && analyzeCompany()}
            className="w-full sm:w-96 px-6 py-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-md transition-all shadow-inner placeholder-slate-500"
          />
          <button 
            onClick={analyzeCompany} 
            disabled={loading}
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl text-lg transition-all transform hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Analyzing...
              </span>
            ) : 'Analyze'}
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="max-w-2xl mx-auto p-4 mb-12 bg-red-900/20 border border-red-500/30 rounded-xl text-red-400 text-center backdrop-blur-sm animate-fade-in">
            {error}
          </div>
        )}

        {/* Results Dashboard */}
        {data && !loading && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Top Overview Card */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900/60 border border-slate-700/50 backdrop-blur-xl p-8 rounded-2xl shadow-2xl">
              <div className="text-center md:text-left mb-6 md:mb-0">
                <h2 className="text-4xl font-bold text-white mb-2">{data.companyOverview?.name || symbol.toUpperCase()}</h2>
                <span className="inline-block px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg font-semibold tracking-wide">
                  {symbol.toUpperCase()}
                </span>
              </div>
              <div className="text-center">
                <p className="text-slate-400 text-sm uppercase tracking-wider mb-2 font-semibold">Recommendation</p>
                <div className={`text-4xl font-black px-8 py-3 rounded-xl border-2 shadow-lg tracking-widest uppercase
                  ${data.recommendation === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 
                    data.recommendation === 'HOLD' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 
                    'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                  {data.recommendation || 'HOLD'}
                </div>
              </div>
            </div>

            {/* Scores Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Overall Score', value: data.investmentScore?.overallScore || data.score },
                { label: 'Growth', value: data.investmentScore?.growthScore || '--' },
                { label: 'Financial Health', value: data.investmentScore?.financialHealth || '--' },
                { label: 'Risk', value: data.investmentScore?.riskScore || '--' },
                { label: 'Valuation', value: data.investmentScore?.valuationScore || '--' }
              ].map((item, i) => (
                <div key={i} className="bg-slate-900/40 border border-slate-800 backdrop-blur-lg p-6 rounded-2xl text-center hover:bg-slate-800/60 hover:-translate-y-1 transition-all duration-300">
                  <h3 className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-semibold">{item.label}</h3>
                  <div className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-br from-blue-400 to-blue-600">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Main Panels Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Thesis Panel */}
              <div className="bg-slate-900/40 border border-slate-800 backdrop-blur-lg p-8 rounded-2xl hover:border-slate-700 transition-colors">
                <h3 className="text-xl font-semibold text-white mb-6 pb-4 border-b border-slate-800">Investment Thesis</h3>
                <p className="text-slate-300 leading-relaxed mb-6">{data.reasoning || "Based on the provided data, the company shows strong potential but carries inherent market risks. Detailed reasoning requires complete backend data output."}</p>
                <div className="bg-blue-900/10 border-l-4 border-blue-500 p-4 rounded-r-lg">
                  <strong className="text-slate-200">Confidence Level: </strong>
                  <span className="text-blue-400 font-semibold">{data.confidenceLevel || 'Medium'}</span>
                  <p className="text-sm text-slate-400 mt-2">{data.confidenceExplanation}</p>
                </div>
              </div>

              {/* Financial Metrics Panel */}
              <div className="bg-slate-900/40 border border-slate-800 backdrop-blur-lg p-8 rounded-2xl hover:border-slate-700 transition-colors">
                <h3 className="text-xl font-semibold text-white mb-6 pb-4 border-b border-slate-800">Financial Overview</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'P/E Ratio', value: data.financialAnalysis?.peRatio || '--' },
                    { label: 'EPS', value: data.financialAnalysis?.eps || '--' },
                    { label: 'Rev Growth', value: data.financialAnalysis?.revenueGrowth || '--' },
                    { label: 'ROE', value: data.financialAnalysis?.roe || '--' },
                    { label: 'Oper. Margin', value: data.financialAnalysis?.operatingMargin || '--' },
                    { label: 'Debt/Equity', value: data.financialAnalysis?.debtToEquity || '--' }
                  ].map((metric, i) => (
                    <div key={i} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 flex flex-col justify-center">
                      <span className="text-xs text-slate-400 mb-1">{metric.label}</span>
                      <span className="text-lg font-semibold text-slate-200">{metric.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SWOT Analysis */}
              <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 backdrop-blur-lg p-8 rounded-2xl hover:border-slate-700 transition-colors">
                <h3 className="text-xl font-semibold text-white mb-6 pb-4 border-b border-slate-800">SWOT Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  {/* Strengths */}
                  <div className="bg-slate-950/30 p-6 rounded-xl border border-emerald-900/30">
                    <h4 className="text-emerald-400 font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                      Strengths
                    </h4>
                    <ul className="space-y-3 text-slate-300 text-sm">
                      {(data.swotAnalysis?.strengths || data.swot?.strengths || []).map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-500 mt-1">•</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Weaknesses */}
                  <div className="bg-slate-950/30 p-6 rounded-xl border border-red-900/30">
                    <h4 className="text-red-400 font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                      Weaknesses
                    </h4>
                    <ul className="space-y-3 text-slate-300 text-sm">
                      {(data.swotAnalysis?.weaknesses || data.swot?.weaknesses || []).map((w, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-red-500 mt-1">•</span> {w}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Opportunities */}
                  <div className="bg-slate-950/30 p-6 rounded-xl border border-blue-900/30">
                    <h4 className="text-blue-400 font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
                      Opportunities
                    </h4>
                    <ul className="space-y-3 text-slate-300 text-sm">
                      {(data.swotAnalysis?.opportunities || data.swot?.opportunities || []).map((o, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-blue-500 mt-1">•</span> {o}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Threats */}
                  <div className="bg-slate-950/30 p-6 rounded-xl border border-amber-900/30">
                    <h4 className="text-amber-400 font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      Threats
                    </h4>
                    <ul className="space-y-3 text-slate-300 text-sm">
                      {(data.swotAnalysis?.threats || data.swot?.threats || []).map((t, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-500 mt-1">•</span> {t}
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
