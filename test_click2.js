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

        console.log("clicking data_merge...");
        await page.click('div[data-analysis="data_merge"]', { force: true });

        await page.waitForTimeout(2000);

        const isAnalysisAreaVisible = await page.isVisible('#analysis-area');
        const text = await page.textContent('#analysis-content');
        console.log("Analysis area visible:", isAnalysisAreaVisible);
        console.log("Analysis content text exists:", text !== null && text.trim().length > 0);
        if (text) console.log(text.substring(0, 100).replace(/\n/g, ' '));
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await browser.close();
    }
})();
