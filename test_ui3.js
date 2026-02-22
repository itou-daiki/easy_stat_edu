const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    await page.goto("http://127.0.0.1:8080");
    await page.waitForSelector('.feature-card');
    
    // Upload dummy data
    const fs = require('fs');
    if (!fs.existsSync('dummy.csv')) {
        fs.writeFileSync('dummy.csv', 'A,B\n1,2\n3,4');
    }
    await page.setInputFiles('#csv-file', 'dummy.csv');
    await page.waitForTimeout(1000); // wait for load
    
    console.log("clicking data_processing...");
    await page.click('div[data-analysis="data_processing"]', { force: true });
    await page.waitForTimeout(2000);
    
    const isVisible = await page.isVisible('.multiselect-wrapper');
    console.log("Checking if multiselect-wrapper exists:", isVisible);
    
  } catch (err) {
    console.error("TEST SCRIPT ERROR:", err);
  } finally {
    await browser.close();
  }
})();
