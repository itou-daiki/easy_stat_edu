import { test, expect } from '@playwright/test';
import * as path from 'path';

test('debug locate group-var', async ({ page }) => {
    // タイムアウトを10秒に
    test.setTimeout(10000);

    await page.goto('/');
    const fileInput = page.locator('#main-data-file');
    const filePath = path.join(__dirname, '../datasets/ttest_demo.xlsx');
    await fileInput.setInputFiles(filePath);
    await page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 5000 });

    // click card
    await page.locator('.feature-card[data-analysis="ttest"]').click();
    await page.waitForSelector('.ttest-container', { state: 'visible', timeout: 5000 });

    console.log("Checking group-var element...");
    const gvar = page.locator('#group-var');
    const count = await gvar.count();
    console.log("Count:", count);
    if (count > 0) {
        console.log("IsVisible:", await gvar.first().isVisible());
        console.log("IsAttached:", await gvar.first().evaluate(() => true).catch(e => "Error:" + e.message));
        console.log("HTML:", await gvar.first().evaluate(node => node.outerHTML));
    }
});
