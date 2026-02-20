import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('McNemar Test', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', (msg: any) => console.log('BROWSER:', msg.text()));
        page.on('dialog', (dialog: any) => dialog.accept());
        await page.goto('http://127.0.0.1:8081/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

        const filePath = path.join(__dirname, '../datasets/mcnemar_test.csv');
        const previewPromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });
        await page.locator('#main-data-file').setInputFiles(filePath);
        await previewPromise;
    });

    test('should navigate to McNemar test card', async ({ page }) => {
        const card = page.locator('.feature-card[data-analysis="mcnemar"]');
        await expect(card).toBeVisible();
        await card.click();
        await expect(page.locator('#analysis-area')).toBeVisible({ timeout: 10000 });
    });

    test('should run McNemar test and display results', async ({ page }) => {
        await page.locator('.feature-card[data-analysis="mcnemar"]').click();
        await expect(page.locator('#analysis-area')).toBeVisible({ timeout: 10000 });

        // 変数1を選択（授業前理解）
        await page.locator('#mcnemar-var1').selectOption('授業前理解');
        // 変数2を選択（授業後理解）
        await page.locator('#mcnemar-var2').selectOption('授業後理解');

        // 分析実行
        await page.locator('#run-mcnemar-btn').click();

        // 結果表示
        const results = page.locator('#mcnemar-results');
        await expect(results).toBeVisible({ timeout: 10000 });

        // 2×2分割表が表示されること
        await expect(results).toContainText('分割表');

        // χ²値が表示されること
        await expect(results).toContainText('χ²');

        // p値が表示されること
        await expect(results).toContainText('p');

        // 効果量が表示されること
        await expect(results).toContainText('効果量');
    });
});
