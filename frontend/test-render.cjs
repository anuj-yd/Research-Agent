const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));
  page.on('requestfailed', request => console.error('REQUEST FAILED:', request.url(), request.failure().errorText));

  console.log('Navigating to evofox...');
  try {
    await page.goto('http://localhost:5173/analyze/evofox', { waitUntil: 'networkidle0', timeout: 30000 });
    console.log('Navigation complete. Waiting 3s to let React settle...');
    await new Promise(r => setTimeout(r, 3000));
    console.log('Done.');
  } catch (err) {
    console.error('Script error:', err.message);
  } finally {
    await browser.close();
  }
})();
