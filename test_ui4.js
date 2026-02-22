const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.goto("http://127.0.0.1:8080");
    await page.waitForSelector('.feature-card');
    
    // Evaluate in page context instead of uploading file
    await page.evaluate(() => {
        // mock data load
        window.currentData = [{A:1, B:2}, {A:3, B:4}];
        window.dataCharacteristics = {
            numericColumns: ['A', 'B'],
            categoricalColumns: [],
            textColumns: []
        };
        window.updateFeatureCards();
    });
    
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
