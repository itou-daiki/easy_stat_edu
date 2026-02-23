const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Factor Analysis Rotation Tests using demo data', () => {
    test.beforeEach(async ({ page }) => {
        // コンソールログをターミナルに表示 (デバッグ用)
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
        page.on('pageerror', err => console.log(`BROWSER ERROR: ${err}`));

        await page.goto('http://127.0.0.1:8081/');
        await expect(page.locator('#loading-screen')).toBeHidden();

        // データアップロード
        const fileInput = page.locator('#main-data-file');
        await fileInput.setInputFiles(path.join(__dirname, '../datasets/demo_all_analysis.csv'));

        // 因子分析へ移動
        await page.locator('.feature-card[data-analysis="factor_analysis"]').click();



        await expect(page.locator('#analysis-area')).toBeVisible();

        // Wait for variable selector to be available
        await page.locator('#factor-vars-container .multiselect-input').waitFor({ state: 'visible', timeout: 5000 });

    });

    test('should run Factor Analysis with Promax rotation', async ({ page }) => {
        // 変数選択 (数学, 英語, 理科, 学習時間)
        await page.locator('#factor-vars-container .multiselect-input').click();

        // Select variables
        const variables = ['数学', '英語', '理科', '学習時間'];
        for (const v of variables) {
            await page.locator(`.multiselect-option[data-value="${v}"]`).click();
        }

        // Close dropdown
        await page.locator('#factor-vars-container .multiselect-input').click();

        // Select Promax
        await page.selectOption('#rotation-method', 'promax');

        // Run Analysis
        await page.click('#run-factor-btn');

        // Verify Results
        await expect(page.locator('#fa-analysis-results')).toBeVisible();
        await expect(page.locator('#loadings-table')).toContainText('因子間相関');

        // Check for 1.000 in diagonal (Correlation with itself)
        await expect(page.locator('#loadings-table')).toContainText('1.000');
    });

    test('should run Factor Analysis with Direct Oblimin rotation', async ({ page }) => {
        // Setup variables
        await page.locator('#factor-vars-container .multiselect-input').click();
        const variables = ['数学', '英語', '理科', '学習時間'];
        for (const v of variables) {
            await page.locator(`.multiselect-option[data-value="${v}"]`).click();
        }
        await page.locator('#factor-vars-container .multiselect-input').click();

        // Select Oblimin
        await page.selectOption('#rotation-method', 'oblimin');

        // Run Analysis
        await page.click('#run-factor-btn');

        // Verify Results
        await expect(page.locator('#fa-analysis-results')).toBeVisible();
    });

    test('should run Factor Analysis with Geomin rotation', async ({ page }) => {
        // Setup variables
        await page.locator('#factor-vars-container .multiselect-input').click();
        const variables = ['数学', '英語', '理科', '学習時間'];
        for (const v of variables) {
            await page.locator(`.multiselect-option[data-value="${v}"]`).click();
        }
        await page.locator('#factor-vars-container .multiselect-input').click();

        // Select Geomin
        await page.selectOption('#rotation-method', 'geomin');

        // Run Analysis
        await page.click('#run-factor-btn');

        // Verify Results
        await expect(page.locator('#fa-analysis-results')).toBeVisible();
    });
});
