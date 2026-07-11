const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

(async () => {
  try {
    const res = await yahooFinance.search('AAPL', { newsCount: 2 });
    console.log(res.news.length);
  } catch (e) {
    console.error(e.message);
  }
})();
