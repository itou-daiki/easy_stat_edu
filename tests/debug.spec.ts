import { test, expect } from '@playwright/test';
import * as path from 'path';

test('debug t-test', async ({ page }) => {
    await page.goto('/');
    const fileInput = page.locator('#main-data-file');
    const filePath = path.join(__dirname, '../datasets/ttest_demo.xlsx');
    await fileInput.setInputFiles(filePath);
    await page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 5000 });

    // click card
    const card = page.locator('.feature-card[data-analysis="ttest"]');
    await expect(card).toBeVisible();
    await card.click();

    await page.waitForSelector('.ttest-container', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'debug_ttest.png' });

    console.log("HTML:", await page.locator('.ttest-container').innerHTML());
});
