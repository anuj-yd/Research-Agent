const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

(async () => {
  try {
    const sym = 'AAPL';
    const quote = await yahooFinance.quoteSummary(sym, { modules: ['summaryDetail', 'assetProfile', 'financialData', 'defaultKeyStatistics'] });
    
    const sd = quote.summaryDetail || {};
    const fd = quote.financialData || {};
    const ap = quote.assetProfile || {};
    const ks = quote.defaultKeyStatistics || {};
    
    console.log({
        peRatio:         sd.forwardPE || sd.trailingPE || null,
        eps:             ks.trailingEps || null,
        roe:             fd.returnOnEquity ? (fd.returnOnEquity * 100).toFixed(2) + '%' : null,
        roa:             fd.returnOnAssets ? (fd.returnOnAssets * 100).toFixed(2) + '%' : null,
        operatingMargin: fd.operatingMargins ? (fd.operatingMargins * 100).toFixed(2) + '%' : null,
        profitMargin:    fd.profitMargins ? (fd.profitMargins * 100).toFixed(2) + '%' : null,
        revenueGrowth:   fd.revenueGrowth ? (fd.revenueGrowth * 100).toFixed(2) + '%' : null,
        debtToEquity:    fd.debtToEquity || null,
    });
  } catch (e) {
    console.error(e.message);
  }
})();
