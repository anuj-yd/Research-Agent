const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server.js');
let code = fs.readFileSync(serverFile, 'utf8');

// Normalize to LF
code = code.replace(/\r\n/g, '\n');

// 1. Add yahooFinance require
code = code.replace(
  "const { tavily }                    = require('@tavily/core');",
  "const { tavily }                    = require('@tavily/core');\nconst yahooFinance                  = require('yahoo-finance2').default;"
);

// 2. Remove AV_KEY and FH_KEY from setup
code = code.replace(
  "const AV_KEY     = process.env.ALPHA_VANTAGE_API_KEY;\nconst FH_KEY     = process.env.FINNHUB_API_KEY;\nconst TAVILY_KEY = process.env.TAVILY_API_KEY;",
  "const TAVILY_KEY = process.env.TAVILY_API_KEY;"
);

// 3. Delete fetchAV function block
const fetchAvBlockRegex = /\/\*\*\n \* Fetches data from the Alpha Vantage API\.[\s\S]*?async function fetchAV\(func, symbol, extra = ''\) \{[\s\S]*?\n\}/;
code = code.replace(fetchAvBlockRegex, '');

// 4. Refactor financialTool to use yahooFinance
const newFinancialTool = `const financialTool = new DynamicStructuredTool({
  name: 'get_financial_data',
  description: 'Fetches real-time financial data (P/E, EPS, margins, revenue, balance sheet) for a stock symbol from Yahoo Finance.',
  schema: z.object({
    symbol: z.string().describe('Stock ticker symbol, e.g. AAPL, TSLA, MSFT'),
  }),
  func: async ({ symbol }) => {
    try {
      let sym = symbol.toUpperCase();
      const quote = await yahooFinance.quoteSummary(sym, { modules: ['summaryDetail', 'assetProfile', 'financialData', 'defaultKeyStatistics'] });
      
      if (!quote || !quote.summaryDetail) return JSON.stringify({ error: 'No financial data found', symbol: sym });
      
      const sd = quote.summaryDetail;
      const fd = quote.financialData;
      const ap = quote.assetProfile;
      const ks = quote.defaultKeyStatistics;

      return JSON.stringify({
        name:            quote.price?.longName || sym,
        symbol:          sym,
        sector:          ap?.sector || null,
        industry:        ap?.industry || null,
        description:     (ap?.longBusinessSummary || '').substring(0, 400),
        peRatio:         sd?.forwardPE || sd?.trailingPE || null,
        eps:             ks?.trailingEps || null,
        roe:             fd?.returnOnEquity ? (fd.returnOnEquity * 100).toFixed(2) + '%' : null,
        roa:             fd?.returnOnAssets ? (fd.returnOnAssets * 100).toFixed(2) + '%' : null,
        operatingMargin: fd?.operatingMargins ? (fd.operatingMargins * 100).toFixed(2) + '%' : null,
        profitMargin:    fd?.profitMargins ? (fd.profitMargins * 100).toFixed(2) + '%' : null,
        revenueGrowth:   fd?.revenueGrowth ? (fd.revenueGrowth * 100).toFixed(2) + '%' : null,
        debtToEquity:    fd?.debtToEquity || null,
        beta:            ks?.beta || null,
        marketCap:       sd?.marketCap || null,
        week52High:      sd?.fiftyTwoWeekHigh || null,
        week52Low:       sd?.fiftyTwoWeekLow || null,
        analystTarget:   fd?.targetMeanPrice || null,
        dividendYield:   sd?.dividendYield ? (sd.dividendYield * 100).toFixed(2) + '%' : null,
        freeCashFlow:    fd?.freeCashflow ? '$' + (fd.freeCashflow / 1e9).toFixed(2) + 'B' : null,
        dataSource:      'Yahoo Finance (Free)',
      });
    } catch (err) {
      return JSON.stringify({ error: err.message });
    }
  },
});`;

const financialToolRegex = /const financialTool = new DynamicStructuredTool\(\{[\s\S]*?\}\);\n/;
code = code.replace(financialToolRegex, () => newFinancialTool + "\n");

// 5. Refactor get_company_news tool to use yahooFinance
const newNewsTool = `const newsTool = new DynamicStructuredTool({
  name: 'get_company_news',
  description: 'Fetches recent news headlines, summaries, and URLs for a company from Yahoo Finance.',
  schema: z.object({ symbol: z.string() }),
  func: async ({ symbol }) => {
    try {
      const sym = symbol.toUpperCase();
      const res = await yahooFinance.search(sym, { newsCount: 10 });
      const newsItems = res.news || [];
      console.log(\`Yahoo Finance returned \${newsItems.length} articles for \${sym}\`);

      if (newsItems.length === 0) {
        return JSON.stringify({ articles: [], source: 'yfinance_empty', symbol: sym });
      }

      const articles = newsItems.map(n => ({
        headline: n.title,
        source:   n.publisher,
        summary:  (n.title || '').substring(0, 300),
        url:      n.link,
        datetime: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : new Date().toISOString()
      }));

      return JSON.stringify({ articles, source: 'yahoo_finance', symbol: sym });
    } catch (err) {
      console.error('Yahoo news error:', err.message);
      return JSON.stringify({ error: err.message });
    }
  },
});`;

const newsToolRegex = /const newsTool = new DynamicStructuredTool\(\{[\s\S]*?\}\);\n/;
code = code.replace(newsToolRegex, () => newNewsTool + "\n");

// 6. Refactor the /api/news/:symbol endpoint
const newNewsEndpoint = `app.get('/api/news/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const sym        = symbol.toUpperCase();

  // --- Yahoo Finance fetch ---
  try {
    const sr = await yahooFinance.search(sym, { newsCount: 10 });
    const newsItems = sr.news || [];
    console.log(\`News endpoint: Yahoo Finance returned \${newsItems.length} articles for \${sym}\`);

    if (newsItems.length > 0) {
      const news = newsItems.map(n => ({
        headline: n.title,
        source:   n.publisher,
        summary:  (n.title || '').substring(0, 300), // Yahoo doesn't usually give summary in search, using title
        url:      n.link,
        image:    n.thumbnail?.resolutions?.[0]?.url || null,
        datetime: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : new Date().toISOString(),
        isYahoo:  true,
      }));
      return res.json(news);
    }
  } catch (err) {
    console.error('Yahoo news error:', err.message);
  }

  // --- Gemini fallback: generate AI-sourced recent events ---
  try {
    console.log(\`Yahoo Finance empty for \${sym} — using Gemini current affairs fallback\`);
    const llm    = new ChatGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY, model: 'gemini-3.5-flash', temperature: 0.3 });
    const prompt = \`List the 6 most recent and significant news events or developments for the stock \${sym} that would matter to an investor. Include earnings results, product launches, executive changes, regulatory news, and analyst upgrades/downgrades. Format each as a JSON object with headline (string), source ("AI Research"), summary (string, 1-2 sentences), and datetime (approximate ISO date). Return ONLY a valid JSON array, no markdown.\`;
    const result = await llm.invoke(prompt);
    const match  = result.content.match(/\\[\\s*\\{[\\s\\S]*\\}\\s*\\]/);
    if (match) {
      const articles = JSON.parse(match[0]).map(a => ({ ...a, isAIGenerated: true }));
      return res.json(articles);
    }
  } catch (err) {
    console.error('Gemini news fallback error:', err.message);
  }

  res.json([]);
});`;

const newsEndpointRegex = /app\.get\('\/api\/news\/:symbol', async \(req, res\) => \{[\s\S]*?\n\}\);\n/;
code = code.replace(newsEndpointRegex, () => newNewsEndpoint + "\n");

// 7. Remove AV/FH keys from startup logs
code = code.replace(
  "console.log(`  Alpha Vantage: ${AV_KEY ? 'connected' : 'missing key'}`);\n  console.log(`  Finnhub      : ${FH_KEY ? 'connected' : 'missing key'}`);",
  "console.log(`  Yahoo Finance: connected (built-in)`);"
);

fs.writeFileSync(serverFile, code);
console.log('Refactor complete.');
