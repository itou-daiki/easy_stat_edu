import { test, expect } from '@playwright/test';

test.describe('Analysis Support Feature', () => {
    test.beforeEach(async ({ page }) => {
        // Setup console logs
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));

        await page.goto('http://127.0.0.1:8081/');
        await page.waitForSelector('#load-demo-btn', { state: 'visible' });
        await page.click('#load-demo-btn');
        await page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 5000 });
    });

    test('should recommend Correlation/Regression for 2 numeric variables', async ({ page }) => {
        // 1. Open Analysis Support
        const card = page.locator('.feature-card[data-analysis="analysis_support"]');
        await expect(card).toBeVisible();
        await card.click();

        await expect(page.locator('#analysis-area h3').filter({ hasText: '分析サポーター' })).toBeVisible();

        // 2. Select variables: Math and Science (2 numeric)
        // Click custom multiselect input to open dropdown
        await page.click('#support-multiselect .multiselect-input');

        // Select '数学'
        await page.locator('.multiselect-option').filter({ hasText: '数学' }).click();
        // Select '理科'
        await page.locator('.multiselect-option').filter({ hasText: '理科' }).click();

        // Close dropdown
        await page.click('body', { position: { x: 0, y: 0 } });

        // 3. Verify Recommendations
        const recArea = page.locator('#recommendation-area');
        await expect(recArea).toBeVisible();

        const recList = page.locator('#recommendation-list');
        await expect(recList).toContainText('相関分析');
        await expect(recList).toContainText('単回帰分析');
    });

    test('should recommend T-test/U-test for 1 numeric + 1 binary categorical', async ({ page }) => {
        // 1. Open Analysis Support
        await page.locator('.feature-card[data-analysis="analysis_support"]').click();

        // 2. Select variables: Math (Num) + Gender (Cat, 2 levels)
        await page.click('#support-multiselect .multiselect-input');
        await page.locator('.multiselect-option').filter({ hasText: '数学' }).click();
        await page.locator('.multiselect-option').filter({ hasText: '性別' }).click();

        // 3. Verify Recommendations
        const recList = page.locator('#recommendation-list');
        await expect(recList).toContainText('t検定');
        await expect(recList).toContainText('マン・ホイットニーのU検定');
    });

    test('should navigate to analysis when recommendation clicked', async ({ page }) => {
        // Open Support
        await page.locator('.feature-card[data-analysis="analysis_support"]').click();

        // Select Math + Science -> Regression
        await page.click('#support-multiselect .multiselect-input');
        await page.locator('.multiselect-option').filter({ hasText: '数学' }).click();
        await page.locator('.multiselect-option').filter({ hasText: '理科' }).click();

        // Click "単回帰分析" recommendation
        // Note: The structure is h5 text inside the rec-item
        const targetRec = page.locator('.rec-item').filter({ hasText: '単回帰分析' });
        await targetRec.click();

        // Verify navigation (Header should change to 单回帰分析)
        // Adjust locator based on regression analysis UI
        await expect(page.locator('#analysis-header')).toBeVisible();
        // Assuming regression module renders title
        await expect(page.locator('#analysis-area')).toContainText('単回帰分析');
    });
});
