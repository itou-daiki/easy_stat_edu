const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    console.log("Navigating to http://127.0.0.1:8080");
    await page.goto("http://127.0.0.1:8080");
    await page.waitForSelector('.feature-card');
    
    console.log("clicking data_processing...");
    await page.click('div[data-analysis="data_processing"]', { force: true });
    
    await page.waitForTimeout(2000);
    console.log("Checking if multiselect-wrapper exists:", await page.isVisible('.multiselect-wrapper'));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
})();
