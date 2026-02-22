import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Start local server or just rely on the existing one if it's up?
    // Wait, the test uses localhost:8081. Let's assume it's up.
    try {
        await page.goto('http://127.0.0.1:8081/');

        // Wait for load
        await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 30000 });

        // Upload file
        const fileInput = await page.locator('#csv-file');
        await fileInput.setInputFiles('datasets/demo_all_analysis.csv');
        await page.locator('.feature-card[data-analysis="factor_analysis"]').click();
        await page.waitForTimeout(500);

        // Select variables
        const variables = ['数学', '英語', '理科', '学習時間'];
        for (const v of variables) {
            await page.click(`#factor-vars-container .form-check:has-text("${v}") input`);
        }

        await page.selectOption('#rotation-method', 'varimax');
        await page.click('#run-factor-btn');

        await page.locator('#fa-analysis-results').waitFor({ state: 'visible', timeout: 10000 });

        const html = await page.locator('#loadings-table').innerHTML();
        console.log("=== LOADINGS TABLE HTML ===");
        console.log(html);
        console.log("===========================");

    } catch (e) {
        console.error("ERROR:", e);
    } finally {
        await browser.close();
    }
})();
