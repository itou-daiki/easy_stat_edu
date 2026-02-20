import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Logistic Regression', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', (msg: any) => console.log('BROWSER:', msg.text()));
        page.on('dialog', (dialog: any) => dialog.accept());
        await page.goto('http://127.0.0.1:8081/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await page.waitForSelector('.feature-grid', { timeout: 10000 });
    });

    test('should navigate to logistic regression after data upload', async ({ page }) => {
        // データをアップロード
        const filePath = path.join(__dirname, '../datasets/logistic_demo.csv');
        const fileInput = page.locator('#main-data-file');
        const previewPromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });
        await fileInput.setInputFiles(filePath);
        await previewPromise;

        // ロジスティック回帰カードをクリック
        const card = page.locator('.feature-card[data-analysis="logistic_regression"]');
        await expect(card).toBeVisible();
        await card.click();
        await expect(page.locator('#analysis-area')).toBeVisible({ timeout: 10000 });
    });

    test('should run logistic regression and display results', async ({ page }) => {
        // データをアップロード
        const filePath = path.join(__dirname, '../datasets/logistic_demo.csv');
        const previewPromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });
        await page.locator('#main-data-file').setInputFiles(filePath);
        await previewPromise;

        // ロジスティック回帰に遷移
        await page.locator('.feature-card[data-analysis="logistic_regression"]').click();
        await expect(page.locator('#analysis-area')).toBeVisible({ timeout: 10000 });

        // 目的変数を選択（合否）
        await page.locator('#logistic-dep-var').selectOption('合否');

        // 説明変数を選択（テスト得点 — カスタムマルチセレクト）
        const multiSelect = page.locator('#logistic-indep-var-multiselect-wrapper .multiselect-input, .multiselect-wrapper .multiselect-input').first();
        await multiSelect.click();
        const option = page.locator('.multiselect-option').filter({ hasText: 'テスト得点' });
        await option.click();

        // ドロップダウンを閉じるためにページ余白をクリック
        await page.locator('body').click({ position: { x: 10, y: 10 } });
        await page.waitForTimeout(300);

        // 分析を実行
        await page.locator('#run-logistic-btn').click();

        // 結果が表示されること
        await expect(page.locator('#logistic-results')).toBeVisible({ timeout: 10000 });

        // オッズ比が含まれること
        await expect(page.locator('#logistic-results')).toContainText('オッズ比');

        // 混同行列が表示されること
        await expect(page.locator('#logistic-results')).toContainText('混同行列');

        // 正解率が表示されること
        await expect(page.locator('#logistic-results')).toContainText('正解率');
    });
});
