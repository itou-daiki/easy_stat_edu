/**
 * @file Factor Analysis 基本機能テスト
 * @description 因子分析の基本機能（因子抽出、スクリープロット、因子負荷量）をテスト
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Factor Analysis Basic Feature Tests', () => {
    test.beforeEach(async ({ page }) => {
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
        await page.locator('#factor-vars-container .multiselect-input').waitFor({ state: 'visible', timeout: 5000 });
    });

    test('should display eigenvalues and scree plot', async ({ page }) => {
        // 変数選択
        await page.locator('#factor-vars-container .multiselect-input').click();
        const variables = ['数学', '英語', '理科', '学習時間'];
        for (const v of variables) {
            await page.locator(`.multiselect-option input[value="${v}"]`).check();
        }
        await page.locator('#factor-vars-container .multiselect-input').click();

        // 実行
        await page.click('#run-factor-btn');

        // 結果確認
        await expect(page.locator('#fa-analysis-results')).toBeVisible();

        // 固有値テーブル確認
        await expect(page.locator('#eigenvalues-table')).toBeVisible();
        await expect(page.locator('#eigenvalues-table')).toContainText('固有値');

        // スクリープロット確認
        await expect(page.locator('#scree-plot')).toBeVisible();
    });

    test('should display factor loadings matrix', async ({ page }) => {
        // 変数選択
        await page.locator('#factor-vars-container .multiselect-input').click();
        const variables = ['数学', '英語', '理科', '学習時間'];
        for (const v of variables) {
            await page.locator(`.multiselect-option input[value="${v}"]`).check();
        }
        await page.locator('#factor-vars-container .multiselect-input').click();

        // 実行
        await page.click('#run-factor-btn');

        // 因子負荷量テーブル確認
        await expect(page.locator('#loadings-table')).toBeVisible();
        await expect(page.locator('#loadings-table')).toContainText('因子負荷量');
    });

    test('should display factor interpretation', async ({ page }) => {
        // 変数選択
        await page.locator('#factor-vars-container .multiselect-input').click();
        const variables = ['数学', '英語', '理科', '学習時間'];
        for (const v of variables) {
            await page.locator(`.multiselect-option input[value="${v}"]`).check();
        }
        await page.locator('#factor-vars-container .multiselect-input').click();

        // 実行
        await page.click('#run-factor-btn');

        // 因子解釈セクション確認
        await expect(page.locator('#factor-interpretation')).toBeVisible();
        await expect(page.locator('#factor-interpretation')).toContainText('因子');
    });

    test('should run with Varimax rotation (default)', async ({ page }) => {
        // 変数選択
        await page.locator('#factor-vars-container .multiselect-input').click();
        const variables = ['数学', '英語', '理科', '学習時間'];
        for (const v of variables) {
            await page.locator(`.multiselect-option input[value="${v}"]`).check();
        }
        await page.locator('#factor-vars-container .multiselect-input').click();

        // Varimax選択（デフォルト）
        await page.selectOption('#rotation-method', 'varimax');

        // 実行
        await page.click('#run-factor-btn');

        // 結果確認（因子間相関は直交回転なので表示されないことを確認）
        await expect(page.locator('#fa-analysis-results')).toBeVisible();
        await expect(page.locator('#loadings-table')).toBeVisible();
    });
});
