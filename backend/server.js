require('dotenv').config(); // MUST be first!

// Catch any silent crashes
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error(err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

const express = require('express');
const cors = require('cors');
// Prisma imports (lazy-loaded when needed)
// const { PrismaClient } = require('@prisma/client');
// const { Pool } = require('pg');
// const { PrismaPg } = require('@prisma/adapter-pg');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { StructuredOutputParser } = require('@langchain/core/output_parsers');
const { PromptTemplate } = require('@langchain/core/prompts');
const { z } = require('zod');

// Prisma setup — lazy initialized, not needed for core analysis
// const dbUrl = (process.env.DATABASE_URL || '').replace(/\?schema=\w+/, '');
// const pool = new Pool({ connectionString: dbUrl });
// const adapter = new PrismaPg(pool);
// const prisma = new PrismaClient({ adapter });

const app = express();
const port = process.env.PORT || 5000;
const AV_KEY = process.env.ALPHA_VANTAGE_API_KEY;

app.use(cors());
app.use(express.json());

// --- Alpha Vantage Helper ---
async function fetchAV(func, symbol, extra = '') {
  const url = `https://www.alphavantage.co/query?function=${func}&symbol=${symbol}&apikey=${AV_KEY}${extra}`;
  const res = await fetch(url);
  return res.json();
}

// Clean AV "None" strings
function avVal(val) {
  if (val === undefined || val === null || val === 'None' || val === '-' || val === '') return null;
  return val;
}

// Format percentage: AV returns 0.024 for 2.4%
function fmtPct(val) {
  const v = parseFloat(val);
  if (isNaN(v)) return null;
  return (v * 100).toFixed(2) + '%';
}

// --- Zod schema ---
const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    companyOverview: z.object({
      name: z.string(),
      sector: z.string(),
      industry: z.string(),
      description: z.string(),
    }),
    recommendation: z.enum(['BUY', 'HOLD', 'PASS']),
    investmentScore: z.object({
      overallScore: z.number().min(0).max(100),
      growthScore: z.number().min(0).max(100),
      financialHealth: z.number().min(0).max(100),
      riskScore: z.number().min(0).max(100),
      valuationScore: z.number().min(0).max(100),
    }),
    financialAnalysis: z.object({
      peRatio: z.string(),
      eps: z.string(),
      revenueGrowth: z.string(),
      roe: z.string(),
      operatingMargin: z.string(),
      debtToEquity: z.string(),
    }),
    swotAnalysis: z.object({
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      opportunities: z.array(z.string()),
      threats: z.array(z.string()),
    }),
    reasoning: z.string(),
    confidenceLevel: z.enum(['High', 'Medium', 'Low']),
    confidenceExplanation: z.string(),
    dataSource: z.string().describe("Either 'Alpha Vantage (Real-Time)' or 'AI Knowledge Base'"),
  })
);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Main analysis route
app.post('/api/analyze', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-2.5-flash',
      temperature: 0.2,
    });

    // ---- STEP 1: Try Alpha Vantage for real data ----
    let financialData = null;
    let dataSource = 'AI Knowledge Base';
    let companyName = query.trim();

    let symbol = query.trim().toUpperCase();
    let overview = await fetchAV('OVERVIEW', symbol);

    // If direct ticker fails, do a symbol search
    if (!overview.Symbol) {
      console.log(`Searching for "${query}" by name...`);
      const searchResult = await fetchAV('SYMBOL_SEARCH', '', `&keywords=${encodeURIComponent(query.trim())}`);
      const matches = searchResult.bestMatches || [];

      // Prefer US equities first
      const usBest = matches.find(m => m['4. region'] === 'United States' && m['3. type'] === 'Equity');
      const anyBest = matches[0];
      const best = usBest || anyBest;

      if (best) {
        symbol = best['1. symbol'];
        companyName = best['2. name'];
        console.log(`Resolved to: ${symbol} (${companyName})`);

        // Only try AV OVERVIEW for US-listed stocks
        if (best['4. region'] === 'United States') {
          overview = await fetchAV('OVERVIEW', symbol);
        }
      }
    }

    // If we got valid US stock data, fetch full financials
    if (overview.Symbol) {
      console.log(`Fetching full financials from Alpha Vantage for ${symbol}...`);
      companyName = overview.Name || companyName;
      dataSource = 'Alpha Vantage (Real-Time)';

      const incomeStatement = await fetchAV('INCOME_STATEMENT', symbol);
      const balanceSheet    = await fetchAV('BALANCE_SHEET', symbol);
      const cashFlow        = await fetchAV('CASH_FLOW', symbol);

      const latestIncome   = incomeStatement.annualReports?.[0] || {};
      const prevIncome     = incomeStatement.annualReports?.[1] || {};
      const latestBalance  = balanceSheet.annualReports?.[0] || {};
      const latestCashFlow = cashFlow.annualReports?.[0] || {};

      // Revenue growth (calculated from raw statements — more reliable)
      const rev0 = parseFloat(latestIncome.totalRevenue);
      const rev1 = parseFloat(prevIncome.totalRevenue);
      const revenueGrowth = (!isNaN(rev0) && !isNaN(rev1) && rev1 !== 0)
        ? (((rev0 - rev1) / rev1) * 100).toFixed(1) + '%'
        : avVal(overview.QuarterlyRevenueGrowthYOY)
          ? fmtPct(overview.QuarterlyRevenueGrowthYOY)
          : null;

      // Free Cash Flow
      const ocf  = parseFloat(latestCashFlow.operatingCashflow);
      const capex = parseFloat(latestCashFlow.capitalExpenditures);
      const fcf  = (!isNaN(ocf) && !isNaN(capex))
        ? '$' + ((ocf - Math.abs(capex)) / 1e9).toFixed(2) + 'B'
        : null;

      // Debt/Equity (from balance sheet if AV overview doesn't have it)
      const totalLiab   = parseFloat(latestBalance.totalLiabilities);
      const totalEquity = parseFloat(latestBalance.totalShareholderEquity);
      const debtToEquityCalc = (!isNaN(totalLiab) && !isNaN(totalEquity) && totalEquity !== 0)
        ? (totalLiab / totalEquity).toFixed(2)
        : null;

      financialData = {
        name:                avVal(overview.Name),
        symbol:              overview.Symbol,
        sector:              avVal(overview.Sector),
        industry:            avVal(overview.Industry),
        marketCap:           avVal(overview.MarketCapitalization),
        description:         avVal(overview.Description),
        exchange:            avVal(overview.Exchange),
        peRatio:             avVal(overview.PERatio),
        forwardPE:           avVal(overview.ForwardPE),
        pegRatio:            avVal(overview.PEGRatio),
        priceToBook:         avVal(overview.PriceToBookRatio),
        eps:                 avVal(overview.EPS),
        roe:                 avVal(overview.ReturnOnEquityTTM) ? fmtPct(overview.ReturnOnEquityTTM) : null,
        roa:                 avVal(overview.ReturnOnAssetsTTM) ? fmtPct(overview.ReturnOnAssetsTTM) : null,
        operatingMargin:     avVal(overview.OperatingMarginTTM) ? fmtPct(overview.OperatingMarginTTM) : null,
        profitMargin:        avVal(overview.ProfitMargin) ? fmtPct(overview.ProfitMargin) : null,
        revenueGrowth,
        debtToEquity:        avVal(overview.DebtToEquityRatio) || debtToEquityCalc,
        currentRatio:        avVal(overview.CurrentRatio),
        freeCashFlow:        fcf,
        dividendYield:       avVal(overview.DividendYield) ? fmtPct(overview.DividendYield) : null,
        week52High:          avVal(overview['52WeekHigh']),
        week52Low:           avVal(overview['52WeekLow']),
        beta:                avVal(overview.Beta),
        analystTarget:       avVal(overview.AnalystTargetPrice),
      };

      console.log('✅ Real data collected:', {
        PE: financialData.peRatio,
        EPS: financialData.eps,
        ROE: financialData.roe,
        OpMargin: financialData.operatingMargin,
        RevGrowth: financialData.revenueGrowth,
        DE: financialData.debtToEquity,
      });
    } else {
      // Non-US or unfound company — use Gemini's training knowledge
      console.log(`No AV data found. Using Gemini knowledge base for "${query}"...`);
      dataSource = 'AI Knowledge Base';
    }

    // ---- STEP 2: Build Prompt ----
    const formatInstructions = parser.getFormatInstructions();

    let promptTemplate;
    if (financialData) {
      // Real data path
      promptTemplate = new PromptTemplate({
        template: `You are a senior CFA-level investment analyst. Analyze the REAL financial data below for {symbol} and produce a comprehensive investment report.

REAL FINANCIAL DATA FROM ALPHA VANTAGE (null = data not available):
{financialData}

INSTRUCTIONS:
- For financialAnalysis: Extract values directly from the data. Format nicely:
  * peRatio: e.g. "28.5x" (append 'x')
  * eps: e.g. "$6.43" (prepend '$')
  * revenueGrowth: already formatted with '%', use as-is or write "N/A"
  * roe: already formatted with '%', use as-is or write "N/A"
  * operatingMargin: already formatted with '%', use as-is or write "N/A"
  * debtToEquity: e.g. "0.56x" (append 'x') or "N/A"
- dataSource: "${dataSource}"
- SWOT: 3-4 specific points each, citing actual numbers where available
- reasoning: 2-3 paragraphs with specific data points
- Scores: 0-100 based on all available data

{format_instructions}`,
        inputVariables: ['symbol', 'financialData'],
        partialVariables: { format_instructions: formatInstructions },
      });
    } else {
      // AI knowledge base path (non-US or unknown company)
      promptTemplate = new PromptTemplate({
        template: `You are a senior CFA-level investment analyst. The user wants an investment analysis for: "{query}"

You do NOT have real-time data for this company, so use your training knowledge to provide the best possible analysis.

INSTRUCTIONS:
- Identify the company from the name/query
- Use your knowledge of this company's financials, business model, competitive position
- For financialAnalysis: provide your best estimates based on latest known data (format: peRatio "Xх", eps "$X.XX", revenueGrowth "X%", roe "X%", operatingMargin "X%", debtToEquity "Xx")
- dataSource: "AI Knowledge Base"
- Be clear in your reasoning that this is based on training knowledge, not real-time data
- Still provide a genuine, well-reasoned BUY/HOLD/PASS recommendation
- SWOT: 3-4 specific points each
- reasoning: 2-3 paragraphs

{format_instructions}`,
        inputVariables: ['query'],
        partialVariables: { format_instructions: formatInstructions },
      });
    }

    const input = financialData
      ? await promptTemplate.format({ symbol, financialData: JSON.stringify(financialData, null, 2) })
      : await promptTemplate.format({ query: query.trim() });

    console.log(`Calling Gemini (${dataSource})...`);
    const response = await model.invoke(input);
    const structuredResponse = await parser.parse(response.content);

    console.log(`✅ Analysis complete for "${query}"`);
    res.json(structuredResponse);

  } catch (error) {
    console.error('Analysis error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to analyze investment' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Gemini key:        ${process.env.GEMINI_API_KEY ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Alpha Vantage key: ${AV_KEY ? 'YES ✅' : 'NO ❌'}`);
  console.log('Server is ready and listening for requests...');
});

// Explicit keep-alive (prevents Node from exiting if event loop drains)
setInterval(() => {}, 1 << 30);
