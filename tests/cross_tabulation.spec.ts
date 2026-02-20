import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Cross Tabulation', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', (msg: any) => console.log('BROWSER:', msg.text()));
        page.on('dialog', (dialog: any) => dialog.accept());
        await page.goto('http://127.0.0.1:8081/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

        const filePath = path.join(__dirname, '../datasets/cross_tab_test.csv');
        const previewPromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });
        await page.locator('#main-data-file').setInputFiles(filePath);
        await previewPromise;
    });

    test('should navigate to cross tabulation card', async ({ page }) => {
        const card = page.locator('.feature-card[data-analysis="cross_tabulation"]');
        await expect(card).toBeVisible();
        await card.click();
        await expect(page.locator('#analysis-area')).toBeVisible({ timeout: 10000 });
    });

    test('should display cross tabulation table with counts', async ({ page }) => {
        await page.locator('.feature-card[data-analysis="cross_tabulation"]').click();
        await expect(page.locator('#analysis-area')).toBeVisible({ timeout: 10000 });

        // 行変数を選択（学年）
        await page.locator('#crosstab-row-var').selectOption('学年');
        // 列変数を選択（部活動）
        await page.locator('#crosstab-col-var').selectOption('部活動');

        // 集計実行
        await page.locator('#run-crosstab-btn').click();

        const results = page.locator('#crosstab-results');
        await expect(results).toBeVisible({ timeout: 10000 });

        // クロス集計表が表示されること
        await expect(results).toContainText('合計');

        // 表示モード切替ボタンが存在すること
        await expect(page.locator('#crosstab-mode-count')).toBeVisible();
        await expect(page.locator('#crosstab-mode-row-pct')).toBeVisible();
    });
});
