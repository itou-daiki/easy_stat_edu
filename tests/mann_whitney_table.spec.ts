import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Mann-Whitney U Test - Academic Table Format', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', (msg: any) => console.log('BROWSER:', msg.text()));
        page.on('dialog', (dialog: any) => dialog.accept());
        await page.goto('http://127.0.0.1:8081/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

        // データをアップロード
        const filePath = path.join(__dirname, '../datasets/logistic_demo.csv');
        const previewPromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });
        await page.locator('#main-data-file').setInputFiles(filePath);
        await previewPromise;

        // U検定カードをクリック
        await page.locator('.feature-card[data-analysis="mann_whitney"]').click();
        await expect(page.locator('#analysis-area')).toBeVisible({ timeout: 10000 });
    });

    test('should display academic-style result table with group descriptive stats', async ({ page }) => {
        // グループ変数を選択（合否）
        await page.locator('#group-var').selectOption('合否');

        // 従属変数を選択（テスト得点）
        const multiSelect = page.locator('.multiselect-wrapper .multiselect-input').first();
        await multiSelect.click();
        await page.locator('.multiselect-option').filter({ hasText: 'テスト得点' }).click();
        await page.locator('body').click({ position: { x: 10, y: 10 } });
        await page.waitForTimeout(300);

        // 分析実行
        await page.locator('#run-u-test-btn').click();
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });

        // 結果テーブルに群別の統計量ヘッダーが存在すること
        const resultsTable = page.locator('#test-results-table');
        await expect(resultsTable).toContainText('平均');
        await expect(resultsTable).toContainText('SD');
        await expect(resultsTable).toContainText('中央値');

        // 統計量(U)と効果量(r)が存在すること
        await expect(resultsTable).toContainText('統計量');
        await expect(resultsTable).toContainText('効果量');

        // 脚注にN=とp<の記載があること
        await expect(resultsTable).toContainText('N=');
    });
});
