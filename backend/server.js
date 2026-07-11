/**
 * @file server.js
 * @description Main Express server for the AI Investment Research Agent.
 *
 * Architecture:
 *   - REST API built with Express.js
 *   - LangChain tool-calling agent powered by Google Gemini 2.5 Flash
 *   - PostgreSQL database accessed via Prisma ORM (v7, adapter-based)
 *   - JWT-based authentication with bcrypt password hashing
 *   - Financial data sourced from Alpha Vantage and Finnhub
 *   - PDF report generation via PDFKit
 */

require('dotenv').config();

// Global error handlers to prevent silent crashes
process.on('uncaughtException',  (err) => console.error('Uncaught Exception:', err.message));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

const express  = require('express');
const cors     = require('cors');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const { z }    = require('zod');

const { PrismaClient }              = require('@prisma/client');
const { Pool }                      = require('pg');
const { PrismaPg }                  = require('@prisma/adapter-pg');
const { ChatGoogleGenerativeAI }    = require('@langchain/google-genai');
const { StructuredOutputParser }    = require('@langchain/core/output_parsers');
const { DynamicStructuredTool }     = require('langchain');
const { HumanMessage, SystemMessage, ToolMessage } = require('langchain');
const { tavily }                    = require('@tavily/core');

// ---------------------------------------------------------------------------
// Database Initialization
// Prisma v7 requires the pg adapter instead of a built-in connection string.
// If the database is unavailable, the server starts in a degraded mode where
// auth and report endpoints return 503 — the AI analysis still works.
// ---------------------------------------------------------------------------
let prisma = null;
(async () => {
  try {
    const dbUrl   = (process.env.DATABASE_URL || '').replace(/\?schema=\w+/, '');
    const pool    = new Pool({ connectionString: dbUrl });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();
    console.log('PostgreSQL connected');
  } catch (err) {
    console.warn('PostgreSQL unavailable — auth and reports disabled:', err.message);
    prisma = null;
  }
})();

// ---------------------------------------------------------------------------
// Express App Setup
// ---------------------------------------------------------------------------
const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const AV_KEY     = process.env.ALPHA_VANTAGE_API_KEY;
const FH_KEY     = process.env.FINNHUB_API_KEY;
const TAVILY_KEY = process.env.TAVILY_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// ---------------------------------------------------------------------------
// Authentication Middleware
// ---------------------------------------------------------------------------

/**
 * Enforces a valid Bearer JWT token on a route.
 * Attaches the decoded payload to `req.user`.
 */
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Optionally reads a Bearer token without blocking the request.
 * Used on the /analyze route so authenticated users can be identified.
 */
const optionalAuth = (req, _res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try { req.user = jwt.verify(header.slice(7), JWT_SECRET); } catch {}
  }
  next();
};

// ---------------------------------------------------------------------------
// Alpha Vantage Helpers
// ---------------------------------------------------------------------------

/**
 * Fetches data from the Alpha Vantage API.
 * @param {string} func   - API function name (e.g. 'OVERVIEW', 'INCOME_STATEMENT')
 * @param {string} symbol - Stock ticker symbol
 * @param {string} extra  - Optional additional query parameters
 * @returns {Promise<object>}
 */
async function fetchAV(func, symbol, extra = '') {
  const url = `https://www.alphavantage.co/query?function=${func}&symbol=${symbol}&apikey=${AV_KEY}${extra}`;
  const res = await fetch(url);
  return res.json();
}

/**
 * Normalises a raw Alpha Vantage value.
 * Returns null for empty, undefined, 'None', or '-' values.
 */
const avVal = (v) =>
  (v === undefined || v === null || v === 'None' || v === '-' || v === '') ? null : v;

/**
 * Converts a decimal ratio (e.g. 0.15) to a percentage string (e.g. "15.00%").
 * Returns null if the value is not a valid number.
 */
const fmtPct = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? null : (n * 100).toFixed(2) + '%';
};

// ---------------------------------------------------------------------------
// LangChain Tools
// These tools are called by the Gemini agent during the research loop.
// ---------------------------------------------------------------------------

/**
 * Tool: get_financial_data
 * Fetches comprehensive fundamental data for a stock from Alpha Vantage.
 * Performs a symbol search fallback if the ticker is not found directly.
 */
const financialTool = new DynamicStructuredTool({
  name: 'get_financial_data',
  description: 'Fetches real-time financial data (P/E, EPS, margins, revenue, balance sheet) for a stock symbol from Alpha Vantage.',
  schema: z.object({
    symbol: z.string().describe('Stock ticker symbol, e.g. AAPL, TSLA, MSFT'),
  }),
  func: async ({ symbol }) => {
    try {
      let sym      = symbol.toUpperCase();
      let overview = await fetchAV('OVERVIEW', sym);

      // Fallback: search by keyword if the ticker is not found directly
      if (!overview.Symbol) {
        const search  = await fetchAV('SYMBOL_SEARCH', '', `&keywords=${encodeURIComponent(sym)}`);
        const matches = search.bestMatches || [];
        const best    = matches.find(m => m['4. region'] === 'United States') || matches[0];
        if (best) {
          sym = best['1. symbol'];
          if (best['4. region'] === 'United States') overview = await fetchAV('OVERVIEW', sym);
        }
      }

      if (!overview.Symbol) return JSON.stringify({ error: 'No financial data found', symbol: sym });

      // Revenue growth: compare latest vs prior annual report
      const income = await fetchAV('INCOME_STATEMENT', sym);
      const latest = income.annualReports?.[0] || {};
      const prior  = income.annualReports?.[1]  || {};
      const rev0   = parseFloat(latest.totalRevenue);
      const rev1   = parseFloat(prior.totalRevenue);
      const revenueGrowth = (!isNaN(rev0) && !isNaN(rev1) && rev1 !== 0)
        ? ((rev0 - rev1) / rev1 * 100).toFixed(1) + '%'
        : null;

      // Free cash flow: operating cash flow minus capital expenditures
      const cashFlow = await fetchAV('CASH_FLOW', sym);
      const cf       = cashFlow.annualReports?.[0] || {};
      const ocf      = parseFloat(cf.operatingCashflow);
      const capex    = parseFloat(cf.capitalExpenditures);
      const fcf      = (!isNaN(ocf) && !isNaN(capex))
        ? '$' + ((ocf - Math.abs(capex)) / 1e9).toFixed(2) + 'B'
        : null;

      return JSON.stringify({
        name:            overview.Name,
        symbol:          sym,
        sector:          avVal(overview.Sector),
        industry:        avVal(overview.Industry),
        description:     (avVal(overview.Description) || '').substring(0, 400),
        peRatio:         avVal(overview.PERatio),
        eps:             avVal(overview.EPS),
        roe:             avVal(overview.ReturnOnEquityTTM)  ? fmtPct(overview.ReturnOnEquityTTM)  : null,
        roa:             avVal(overview.ReturnOnAssetsTTM)  ? fmtPct(overview.ReturnOnAssetsTTM)  : null,
        operatingMargin: avVal(overview.OperatingMarginTTM) ? fmtPct(overview.OperatingMarginTTM) : null,
        profitMargin:    avVal(overview.ProfitMargin)       ? fmtPct(overview.ProfitMargin)       : null,
        revenueGrowth,
        debtToEquity:    avVal(overview.DebtToEquityRatio),
        beta:            avVal(overview.Beta),
        marketCap:       avVal(overview.MarketCapitalization),
        week52High:      avVal(overview['52WeekHigh']),
        week52Low:       avVal(overview['52WeekLow']),
        analystTarget:   avVal(overview.AnalystTargetPrice),
        dividendYield:   avVal(overview.DividendYield) ? fmtPct(overview.DividendYield) : null,
        freeCashFlow:    fcf,
        dataSource:      'Alpha Vantage (Real-Time)',
      });
    } catch (err) {
      return JSON.stringify({ error: err.message });
    }
  },
});

/**
 * Tool: get_company_news
 * Fetches the last 30 days of news headlines from Finnhub for a given ticker.
 * Returns up to 10 articles with headline, source, summary, URL, and date.
 * Falls back to an empty array if Finnhub is unavailable or the key is missing.
 */
const newsTool = new DynamicStructuredTool({
  name: 'get_company_news',
  description: 'Fetches recent news headlines, summaries, and URLs for a company from Finnhub (last 30 days).',
  schema: z.object({ symbol: z.string() }),
  func: async ({ symbol }) => {
    if (!FH_KEY) {
      console.log('Finnhub key not configured — skipping news fetch');
      return JSON.stringify({ articles: [], source: 'finnhub_unavailable' });
    }
    try {
      const sym  = symbol.toUpperCase();
      const to   = new Date().toISOString().split('T')[0];
      const from = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
      const res  = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${sym}&from=${from}&to=${to}&token=${FH_KEY}`
      );
      const raw = await res.json();
      console.log(`Finnhub returned ${Array.isArray(raw) ? raw.length : 0} articles for ${sym}`);

      if (!Array.isArray(raw) || raw.length === 0) {
        return JSON.stringify({ articles: [], source: 'finnhub_empty', symbol: sym });
      }

      // Deduplicate by headline prefix, keep most recent first
      const seen    = new Set();
      const articles = raw
        .sort((a, b) => b.datetime - a.datetime)
        .filter(n => {
          const key = n.headline?.substring(0, 60);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 10)
        .map(n => ({
          headline: n.headline,
          source:   n.source,
          summary:  (n.summary || '').substring(0, 300),
          url:      n.url,
          datetime: new Date(n.datetime * 1000).toISOString().split('T')[0],
        }));

      return JSON.stringify({ articles, source: 'finnhub', symbol: sym });
    } catch (err) {
      console.error('Finnhub fetch error:', err.message);
      return JSON.stringify({ articles: [], source: 'finnhub_error', error: err.message });
    }
  },
});

/**
 * Tool: get_current_affairs
 * Uses Gemini's built-in knowledge to surface recent events, controversies,
 * product launches, regulatory changes, and market developments for a company.
 * This complements Finnhub — especially useful when Finnhub returns no results
 * or for broader sector/macro context.
 */
const currentAffairsTool = new DynamicStructuredTool({
  name: 'get_current_affairs',
  description: 'Uses AI knowledge to describe recent events, news, controversies, product launches, regulatory actions, and market developments for a company. Use this alongside or instead of get_company_news.',
  schema: z.object({
    companyName: z.string().describe('Full company name'),
    symbol:      z.string().describe('Stock ticker symbol'),
  }),
  func: async ({ companyName, symbol }) => {
    try {
      const llm    = new ChatGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY, model: 'gemini-3.5-flash', temperature: 0.3 });
      const prompt = `You are a financial news analyst. List the most important and recent developments for ${companyName} (${symbol.toUpperCase()}) that would affect an investment decision.

Cover:
1. Recent earnings results or guidance changes
2. Product launches, partnerships, or acquisitions
3. Regulatory actions, lawsuits, or government scrutiny
4. Leadership changes (CEO, CFO, board)
5. Macroeconomic factors affecting this company/sector
6. Analyst rating changes or price target updates
7. Competitive threats or market share shifts
8. Any controversies or reputational risks

Be specific with dates and numbers where known. Focus on the last 3–6 months.
Format as a numbered list. Be concise but informative.`;

      const result = await llm.invoke(prompt);
      return JSON.stringify({ events: result.content, source: 'gemini_knowledge' });
    } catch (err) {
      return JSON.stringify({ events: 'Could not retrieve current affairs.', error: err.message });
    }
  },
});

/**
 * Tool: tavily_search
 * Fetches recent news, articles, and current events for a company using Tavily API.
 */
const tavilySearchTool = new DynamicStructuredTool({
  name: 'tavily_search',
  description: 'Searches the web for recent news, articles, and current events about a company using Tavily API.',
  schema: z.object({ query: z.string() }),
  func: async ({ query }) => {
    if (!TAVILY_KEY) return JSON.stringify({ error: 'TAVILY_API_KEY not configured', results: [] });
    try {
      const tvly = tavily({ apiKey: TAVILY_KEY });
      const response = await tvly.search(query, {
        searchDepth: "basic",
        maxResults: 5,
        includeImages: false
      });
      return JSON.stringify(response.results);
    } catch (err) {
      return JSON.stringify({ error: err.message, results: [] });
    }
  }
});

/**
 * Tool: calculate_investment_scores
 * Converts raw financial ratios into normalised investment scores (0–100).
 * Scoring logic:
 *   - Valuation: lower P/E → higher score
 *   - Risk:      beta < 1 → lower volatility → higher score
 *   - Financial Health: ROE > 20% → strong returns → high score
 *   - Growth:    revenue growth > 20% → high score
 */
const calculatorTool = new DynamicStructuredTool({
  name: 'calculate_investment_scores',
  description: 'Calculates quantitative investment scores (0–100) from raw financial ratios.',
  schema: z.object({
    peRatio:         z.string().nullable().optional(),
    beta:            z.string().nullable().optional(),
    roe:             z.string().nullable().optional(),
    revenueGrowth:   z.string().nullable().optional(),
    operatingMargin: z.string().nullable().optional(),
  }),
  func: async (d) => {
    const pe     = parseFloat(d.peRatio);
    const beta   = parseFloat(d.beta);
    const roe    = parseFloat(d.roe);
    const growth = parseFloat(d.revenueGrowth);

    const valuationScore    = isNaN(pe)     ? 50 : pe < 15 ? 82 : pe < 25 ? 68 : pe < 40 ? 50 : 30;
    const riskScore         = isNaN(beta)   ? 50 : beta < 0.8 ? 80 : beta < 1.2 ? 65 : beta < 1.5 ? 45 : 28;
    const financialHealth   = isNaN(roe)    ? 50 : roe > 20 ? 85 : roe > 10 ? 65 : roe > 0 ? 45 : 25;
    const growthScore       = isNaN(growth) ? 50 : growth > 20 ? 90 : growth > 10 ? 75 : growth > 0 ? 55 : 30;
    const overallScore      = Math.round((valuationScore + riskScore + financialHealth + growthScore) / 4);

    return JSON.stringify({ overallScore, growthScore, financialHealth, riskScore, valuationScore });
  },
});

// ---------------------------------------------------------------------------
// Report Output Schema
// Enforces the exact JSON structure the frontend expects via Zod + LangChain's
// StructuredOutputParser. Includes newsSentiment for news-driven analysis.
// ---------------------------------------------------------------------------
const reportParser = StructuredOutputParser.fromZodSchema(
  z.object({
    companyOverview: z.object({
      name:        z.string(),
      sector:      z.string(),
      industry:    z.string(),
      description: z.string(),
    }),
    recommendation: z.enum(['BUY', 'HOLD', 'PASS']),
    investmentScore: z.object({
      overallScore:    z.number().min(0).max(100),
      growthScore:     z.number().min(0).max(100),
      financialHealth: z.number().min(0).max(100),
      riskScore:       z.number().min(0).max(100),
      valuationScore:  z.number().min(0).max(100),
    }),
    financialAnalysis: z.object({
      peRatio:         z.string(),
      eps:             z.string(),
      revenueGrowth:   z.string(),
      roe:             z.string(),
      operatingMargin: z.string(),
      debtToEquity:    z.string(),
    }),
    /**
     * newsSentiment: derived from real Finnhub articles + Gemini current affairs.
     * sentiment: overall market mood based on headlines.
     * keyHeadlines: 2–4 most impactful recent headlines.
     * newsImpact: how recent news should adjust the investment decision.
     */
    newsSentiment: z.object({
      sentiment:     z.enum(['Bullish', 'Neutral', 'Bearish']),
      keyHeadlines:  z.array(z.string()),
      newsImpact:    z.string(),
    }),
    swotAnalysis: z.object({
      strengths:     z.array(z.string()),
      weaknesses:    z.array(z.string()),
      opportunities: z.array(z.string()),
      threats:       z.array(z.string()),
    }),
    reasoning:             z.string(),
    confidenceLevel:       z.enum(['High', 'Medium', 'Low']),
    confidenceExplanation: z.string(),
    dataSource:            z.string(),
  })
);

// ===========================================================================
// Routes
// ===========================================================================

/** Health check — returns connection status for all integrations. */
app.get('/api/health', (_req, res) =>
  res.json({
    status:  'ok',
    db:      prisma ? 'connected' : 'disconnected',
    gemini:  !!process.env.GEMINI_API_KEY,
    av:      !!AV_KEY,
    finnhub: !!FH_KEY,
  })
);

// ---------------------------------------------------------------------------
// Auth Routes
// ---------------------------------------------------------------------------

/** Register a new user. Returns a signed JWT and user object on success. */
app.post('/api/auth/register', async (req, res) => {
  if (!prisma) return res.status(503).json({ error: 'Database not connected' });
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'name, email, and password are required' });

    if (await prisma.user.findUnique({ where: { email } }))
      return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user   = await prisma.user.create({ data: { name, email, password: hashed } });
    const token  = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Authenticate an existing user. Returns a signed JWT on success. */
app.post('/api/auth/login', async (req, res) => {
  if (!prisma) return res.status(503).json({ error: 'Database not connected' });
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Returns the currently authenticated user from the JWT payload. */
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

// ---------------------------------------------------------------------------
// News Route
// ---------------------------------------------------------------------------

/**
 * GET /api/news/:symbol
 * Returns up to 10 recent news articles from Finnhub (last 30 days).
 * If Finnhub returns nothing, falls back to Gemini-generated current affairs.
 */
app.get('/api/news/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const sym        = symbol.toUpperCase();

  // --- Finnhub fetch ---
  if (FH_KEY) {
    try {
      const to   = new Date().toISOString().split('T')[0];
      const from = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
      const r    = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${sym}&from=${from}&to=${to}&token=${FH_KEY}`
      );
      const raw  = await r.json();
      console.log(`News endpoint: Finnhub returned ${Array.isArray(raw) ? raw.length : 0} articles for ${sym}`);

      if (Array.isArray(raw) && raw.length > 0) {
        const seen = new Set();
        const news = raw
          .sort((a, b) => b.datetime - a.datetime)
          .filter(n => {
            const key = n.headline?.substring(0, 60);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 10)
          .map(n => ({
            headline: n.headline,
            source:   n.source,
            summary:  (n.summary || '').substring(0, 300),
            url:      n.url,
            image:    n.image,
            datetime: new Date(n.datetime * 1000).toISOString(),
            isFinnhub: true,
          }));
        return res.json(news);
      }
    } catch (err) {
      console.error('Finnhub news error:', err.message);
    }
  }

  // --- Gemini fallback: generate AI-sourced recent events ---
  try {
    console.log(`Finnhub empty for ${sym} — using Gemini current affairs fallback`);
    const llm    = new ChatGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY, model: 'gemini-3.5-flash', temperature: 0.3 });
    const prompt = `List the 6 most recent and significant news events or developments for the stock ${sym} that would matter to an investor. Include earnings results, product launches, executive changes, regulatory news, and analyst upgrades/downgrades. Format each as a JSON object with headline (string), source ("AI Research"), summary (string, 1-2 sentences), and datetime (approximate ISO date). Return ONLY a valid JSON array, no markdown.`;
    const result = await llm.invoke(prompt);
    const match  = result.content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      const articles = JSON.parse(match[0]).map(a => ({ ...a, isAIGenerated: true }));
      return res.json(articles);
    }
  } catch (err) {
    console.error('Gemini news fallback error:', err.message);
  }

  res.json([]);
});

// ---------------------------------------------------------------------------
// Analysis Route — LangChain Agentic Loop
// ---------------------------------------------------------------------------

/**
 * POST /api/analyze
 * Accepts a free-text query (company name or ticker) and runs the full
 * LangChain research pipeline:
 *
 * Phase 1 — Agent Loop (up to 8 iterations):
 *   The Gemini model is bound with the three tools above.
 *   It iteratively calls tools to collect financial data, news, and scores.
 *
 * Phase 2 — Structured Report:
 *   The raw data summary from phase 1 is passed to a second Gemini prompt
 *   that produces a strictly-typed JSON report validated against the Zod schema.
 */
app.post('/api/analyze', optionalAuth, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    console.log(`Analyzing: ${query}`);

    // --- Caching / Deduplication ---
    if (prisma) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const cached = await prisma.investmentReport.findFirst({
        where: {
          OR: [
            { ticker: { equals: query, mode: 'insensitive' } },
            { companyName: { equals: query, mode: 'insensitive' } }
          ],
          createdAt: { gte: yesterday }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (cached && cached.fullReport) {
        console.log(`Cache hit for '${query}' — returning saved report from ${cached.createdAt}`);
        return res.json({ ...cached.fullReport, cached: true });
      }
    }

    // Phase 1: Sequential Data Collection
    console.log('Fetching financial data...');
    const finResult = await financialTool.invoke({ symbol: query });
    let ticker = query;
    let finDataObj = {};
    try { 
      finDataObj = JSON.parse(finResult); 
      if (finDataObj.symbol) ticker = finDataObj.symbol;
    } catch(e) {}

    console.log(`Fetching news for ${ticker}...`);
    const newsResult = await newsTool.invoke({ symbol: ticker });

    console.log('Calculating scores...');
    const scoreResult = await calculatorTool.invoke({
      peRatio: finDataObj.peRatio?.toString(),
      beta: finDataObj.beta?.toString(),
      roe: finDataObj.roe ? finDataObj.roe.replace('%','') : undefined,
      revenueGrowth: finDataObj.revenueGrowth ? finDataObj.revenueGrowth.replace('%','') : undefined,
      operatingMargin: finDataObj.operatingMargin ? finDataObj.operatingMargin.replace('%','') : undefined
    });

    console.log(`Fetching current affairs context for ${ticker}...`);
    const affairsResult = await currentAffairsTool.invoke({ companyName: finDataObj.name || ticker, symbol: ticker });

    console.log(`Searching the web for ${ticker} via Tavily...`);
    const tavilyResult = await tavilySearchTool.invoke({ query: `${finDataObj.name || ticker} stock news current events` });

    const rawSummary = `
      FINANCIAL FUNDAMENTALS:
      ${finResult}
      
      SCORES:
      ${scoreResult}
      
      RECENT NEWS (Finnhub):
      ${newsResult}

      TAVILY WEB SEARCH:
      ${tavilyResult}
      
      CURRENT AFFAIRS / RISKS:
      ${affairsResult}
    `;

    console.log('Data collection complete. Generating structured report...');

    // Phase 2: Generate structured investment report
    // We use exactly ONE LLM call here, staying well within the 20 RPM Free Tier limit.
    const llm = new ChatGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY, model: 'gemini-3.5-flash', temperature: 0.2 });
    
    const formatInstructions = reportParser.getFormatInstructions();
    const reportPrompt = `You are a senior CFA-level investment analyst with access to both quantitative and qualitative research. Produce a complete, accurate investment report from the data below.

RESEARCH DATA (financial fundamentals + live news + current affairs):
${rawSummary}

CRITICAL INSTRUCTIONS:
1. The recommendation (BUY/HOLD/PASS) MUST account for BOTH financial fundamentals AND recent news/current affairs.
   - If news is Bullish (product launch, earnings beat, analyst upgrade): lean toward BUY or upgrade score.
   - If news is Bearish (lawsuit, earnings miss, CEO departure, regulatory fine): lean toward HOLD or PASS and lower the score.
   - If news is Neutral or mixed: stay with what fundamentals suggest.
2. newsSentiment.sentiment must be one of: "Bullish", "Neutral", or "Bearish".
3. newsSentiment.keyHeadlines: list 2–4 real, specific headlines from the news data. Do NOT make up headlines.
4. newsSentiment.newsImpact: explain in 1–2 sentences how the news changes (or confirms) the recommendation.
5. reasoning: write 3 paragraphs:
   - Para 1: Financial fundamentals analysis with specific numbers.
   - Para 2: News/current affairs analysis — reference specific headlines or events.
   - Para 3: Final synthesis — how do fundamentals + news combine to reach the recommendation?

FORMATTING:
- peRatio: append "x" (e.g. "28.5x"), or "N/A"
- eps: prepend "$" (e.g. "$6.43"), or "N/A"
- revenueGrowth, roe, operatingMargin: include "%"
- debtToEquity: append "x" or "N/A"
- dataSource: "Alpha Vantage + Finnhub (Real-Time)" if both were used, "Alpha Vantage (Real-Time)" if only financials, "AI Knowledge Base" if no live data
- SWOT: 3–4 specific, evidence-backed bullet points per quadrant. Include news-driven items in Opportunities/Threats.
- Scores must reflect both quantitative metrics and news sentiment.

${formatInstructions}`;

    const rawReport = await llm.invoke(reportPrompt);
    const report    = await reportParser.parse(rawReport.content);

    console.log(`Report complete — ${report.recommendation} | Score: ${report.investmentScore?.overallScore} | News: ${report.newsSentiment?.sentiment}`);
    res.json(report);

  } catch (err) {
    console.error('Analysis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Saved Reports Routes
// ---------------------------------------------------------------------------

/** Save a completed analysis report to the database for the authenticated user. */
app.post('/api/reports/save', requireAuth, async (req, res) => {
  if (!prisma) return res.status(503).json({ error: 'Database not connected' });
  try {
    const { ticker, companyName, recommendation, score, reasoning, financialData, swot, fullReport } = req.body;
    const report = await prisma.investmentReport.create({
      data: {
        ticker:         ticker?.toUpperCase() || 'UNKNOWN',
        companyName:    companyName || ticker || 'Unknown',
        recommendation: recommendation || 'HOLD',
        score:          parseInt(score) || 0,
        reasoning:      reasoning || '',
        financialData:  financialData || {},
        swot:           swot || {},
        fullReport:     fullReport || {},
        userId:         req.user.id,
      },
    });
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Retrieve all saved reports for the authenticated user, newest first. */
app.get('/api/reports', requireAuth, async (req, res) => {
  if (!prisma) return res.status(503).json({ error: 'Database not connected' });
  try {
    const reports = await prisma.investmentReport.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Delete a report owned by the authenticated user. */
app.delete('/api/reports/:id', requireAuth, async (req, res) => {
  if (!prisma) return res.status(503).json({ error: 'Database not connected' });
  try {
    await prisma.investmentReport.deleteMany({
      where: { id: parseInt(req.params.id), userId: req.user.id },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Generate and stream a PDF version of a saved report.
 * Colour-coded recommendation box, SWOT section, and investment thesis.
 */
app.get('/api/reports/:id/pdf', requireAuth, async (req, res) => {
  if (!prisma) return res.status(503).json({ error: 'Database not connected' });
  try {
    const report = await prisma.investmentReport.findFirst({
      where: { id: parseInt(req.params.id), userId: req.user.id },
    });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.ticker}-research-report.pdf"`);
    doc.pipe(res);

    // Header banner
    doc.rect(0, 0, doc.page.width, 80).fill('#0a0a1a');
    doc.fillColor('#00d4aa').fontSize(22).text('AI Investment Research Report', 50, 25);
    doc.fillColor('#ffffff').fontSize(11).text(
      `Generated ${new Date(report.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      50, 55
    );
    doc.moveDown(3);

    // Company title
    doc.fillColor('#000').fontSize(26).font('Helvetica-Bold').text(report.companyName);
    doc.fontSize(14).fillColor('#444').font('Helvetica').text(`Ticker: ${report.ticker}`);
    doc.moveDown(1);

    // Recommendation badge
    const recColor = report.recommendation === 'BUY' ? '#00d4aa'
                   : report.recommendation === 'PASS' ? '#ef4444' : '#f59e0b';
    doc.rect(50, doc.y, 120, 40).fill(recColor);
    doc.fillColor('#000').fontSize(18).font('Helvetica-Bold')
       .text(report.recommendation, 50, doc.y - 32, { width: 120, align: 'center' });
    doc.moveDown(2);

    doc.fontSize(13).fillColor('#000').font('Helvetica-Bold').text(`Investment Score: ${report.score}/100`);
    doc.moveDown(1);

    // Investment thesis
    if (report.reasoning) {
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text('Investment Thesis');
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#00d4aa');
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica').fillColor('#333').text(report.reasoning, { width: 495, lineGap: 4 });
      doc.moveDown(1.5);
    }

    // SWOT analysis sections
    const swot = report.swot || {};
    const swotSections = [
      { title: 'Strengths',     items: swot.strengths     || [], color: '#00d4aa' },
      { title: 'Weaknesses',    items: swot.weaknesses    || [], color: '#ef4444' },
      { title: 'Opportunities', items: swot.opportunities || [], color: '#3b82f6' },
      { title: 'Threats',       items: swot.threats       || [], color: '#f59e0b' },
    ];

    for (const section of swotSections) {
      if (!section.items.length) continue;
      doc.fontSize(13).font('Helvetica-Bold').fillColor(section.color).text(section.title);
      doc.moveDown(0.3);
      for (const item of section.items) {
        doc.fontSize(11).font('Helvetica').fillColor('#333').text(`• ${item}`, { indent: 10 });
      }
      doc.moveDown(0.8);
    }

    doc.end();
  } catch (err) {
    console.error('PDF error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Watchlist Routes
// ---------------------------------------------------------------------------

/** Return all watchlist entries for the authenticated user. */
app.get('/api/watchlist', requireAuth, async (req, res) => {
  if (!prisma) return res.status(503).json({ error: 'Database not connected' });
  try {
    const list = await prisma.watchlist.findMany({
      where:   { userId: req.user.id },
      orderBy: { addedAt: 'desc' },
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Add a stock to the authenticated user's watchlist. Upserts on (userId, symbol). */
app.post('/api/watchlist', requireAuth, async (req, res) => {
  if (!prisma) return res.status(503).json({ error: 'Database not connected' });
  try {
    const { symbol, companyName } = req.body;
    const item = await prisma.watchlist.upsert({
      where:  { userId_symbol: { userId: req.user.id, symbol: symbol.toUpperCase() } },
      create: { symbol: symbol.toUpperCase(), companyName: companyName || symbol, userId: req.user.id },
      update: { companyName: companyName || symbol },
    });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Remove a stock from the authenticated user's watchlist. */
app.delete('/api/watchlist/:symbol', requireAuth, async (req, res) => {
  if (!prisma) return res.status(503).json({ error: 'Database not connected' });
  try {
    await prisma.watchlist.deleteMany({
      where: { symbol: req.params.symbol.toUpperCase(), userId: req.user.id },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Server Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\nServer listening on port ${PORT}`);
  console.log(`  Gemini AI    : ${process.env.GEMINI_API_KEY ? 'connected' : 'missing key'}`);
  console.log(`  Alpha Vantage: ${AV_KEY ? 'connected' : 'missing key'}`);
  console.log(`  Finnhub      : ${FH_KEY ? 'connected' : 'missing key'}`);
  console.log(`  JWT Secret   : ${JWT_SECRET !== 'dev_secret_change_me' ? 'configured' : 'using default (change in production)'}\n`);
});
