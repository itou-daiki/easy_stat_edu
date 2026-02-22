const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Directly open the index.html file with file:// URI instead of localhost
  const filePath = "file://" + path.resolve('index.html');
  console.log("Navigating to: " + filePath);
  await page.goto(filePath);
  
  // wait for feature cards
  await page.waitForSelector('.feature-card');
  
  console.log("clicking data_merge...");
  await page.click('div[data-analysis="data_merge"]', { force: true });
  
  // wait a bit for analysis view to load
  await page.waitForTimeout(2000);
  
  const isAnalysisAreaVisible = await page.isVisible('#analysis-area');
  const text = await page.textContent('#analysis-content');
  console.log("Analysis area visible:", isAnalysisAreaVisible);
  console.log("Analysis content text exists:", text !== null && text.trim().length > 0);
  if (text) console.log(text.substring(0, 50));
  
  await browser.close();
})();
