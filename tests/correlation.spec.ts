/**
 * @file Correlation Analysis テスト
 * @description 相関分析の機能（相関係数計算、ヒートマップ、有意性検定）をテスト
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Correlation Analysis Tests', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
        page.on('pageerror', err => console.log(`BROWSER ERROR: ${err}`));

        await page.goto('http://127.0.0.1:8081/');
        await expect(page.locator('#loading-screen')).toBeHidden();

        // データアップロード
        const fileInput = page.locator('#main-data-file');
        await fileInput.setInputFiles(path.join(__dirname, '../datasets/demo_all_analysis.csv'));

        // 相関分析へ移動
        await page.locator('.feature-card[data-analysis="correlation"]').click();
        await expect(page.locator('#analysis-area')).toBeVisible();
    });

    test('should calculate and display correlation matrix', async ({ page }) => {
        // 変数選択
        await page.locator('#correlation-vars-container .multiselect-input').click();
        const variables = ['数学', '英語', '理科'];
        for (const v of variables) {
            await page.locator(`.multiselect-option input[value="${v}"]`).check();
        }
        await page.locator('#correlation-vars-container .multiselect-input').click();

        // 実行
        await page.click('#run-correlation-btn');

        // 結果確認
        await expect(page.locator('#analysis-results')).toBeVisible();

        // 相関行列テーブル確認
        await expect(page.locator('#correlation-table')).toBeVisible();

        // 対角成分（1.000）確認
        await expect(page.locator('#correlation-table')).toContainText('1.00');
    });

    test('should display correlation heatmap', async ({ page }) => {
        // 変数選択
        await page.locator('#correlation-vars-container .multiselect-input').click();
        const variables = ['数学', '英語', '理科', '学習時間'];
        for (const v of variables) {
            await page.locator(`.multiselect-option input[value="${v}"]`).check();
        }
        await page.locator('#correlation-vars-container .multiselect-input').click();

        // 実行
        await page.click('#run-correlation-btn');

        // ヒートマップ確認
        await expect(page.locator('#correlation-heatmap')).toBeVisible();
    });

    test('should display significance test results', async ({ page }) => {
        // 変数選択
        await page.locator('#correlation-vars-container .multiselect-input').click();
        const variables = ['数学', '英語'];
        for (const v of variables) {
            await page.locator(`.multiselect-option input[value="${v}"]`).check();
        }
        await page.locator('#correlation-vars-container .multiselect-input').click();

        // 実行
        await page.click('#run-correlation-btn');

        // 有意性検定結果確認（p値表示）
        await expect(page.locator('#analysis-results')).toBeVisible();
        const resultsText = await page.locator('#analysis-results').textContent();
        // p値またはsignificanceの存在を確認
        expect(resultsText).toMatch(/p|有意|significance/i);
    });

    test('should display scatter plot matrix for multiple variables', async ({ page }) => {
        // 変数選択
        await page.locator('#correlation-vars-container .multiselect-input').click();
        const variables = ['数学', '英語', '理科'];
        for (const v of variables) {
            await page.locator(`.multiselect-option input[value="${v}"]`).check();
        }
        await page.locator('#correlation-vars-container .multiselect-input').click();

        // 実行
        await page.click('#run-correlation-btn');

        // 散布図行列確認
        await expect(page.locator('#scatter-matrix, #correlation-visualization')).toBeVisible();
    });
});
