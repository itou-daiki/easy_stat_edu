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
    fs.writeFileSync('dummy.csv', 'A,B\n1,2\n3,4');
    
    // Set file input
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#csv-file');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('dummy.csv');
    
    await page.waitForTimeout(2000); // wait for parsing
    
    console.log("clicking data_processing...");
    await page.click('div[data-analysis="data_processing"]', { force: true });
    await page.waitForTimeout(2000);
    
    const isVisible = await page.isVisible('.multiselect-wrapper');
    console.log("Checking if multiselect-wrapper exists:", isVisible);
    
    if (!isVisible) {
       console.log("Analysis area content:", await page.innerHTML('#analysis-area'));
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
})();
