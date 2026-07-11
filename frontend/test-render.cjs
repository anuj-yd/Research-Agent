const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'home.png' });
  
  await page.goto('http://localhost:5173/analyze/AAPL');
  await page.waitForSelector('.result-company', { timeout: 30000 });
  await page.screenshot({ path: 'analyze.png', fullPage: true });
  
  await browser.close();
})();
