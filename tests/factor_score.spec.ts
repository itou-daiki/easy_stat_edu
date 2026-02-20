import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Factor Score Calculator', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', (msg: any) => console.log('BROWSER:', msg.text()));
        page.on('dialog', (dialog: any) => dialog.accept());
        await page.goto('http://127.0.0.1:8081/');
        await page.waitForSelector('.feature-grid', { timeout: 10000 });
    });

    test('should navigate to factor score without uploading data', async ({ page }) => {
        // データ未アップロードでカードクリック
        const card = page.locator('.feature-card[data-analysis="factor_score"]');
        await card.click();

        // 分析エリアが表示されること
        await expect(page.locator('#analysis-area')).toBeVisible({ timeout: 10000 });

        // 因子得点計算のUIが表示されること
        await expect(page.locator('#fs-upload-scale')).toBeVisible();
        await expect(page.locator('#fs-upload-data')).toBeVisible();
    });

    test('should upload scale info and data files and show previews', async ({ page }) => {
        const card = page.locator('.feature-card[data-analysis="factor_score"]');
        await card.click();
        await expect(page.locator('#analysis-area')).toBeVisible({ timeout: 10000 });

        // 尺度情報ファイルをアップロード
        const scalePath = path.join(__dirname, '../datasets/scale_info_test.csv');
        await page.locator('#fs-scale-file-input').setInputFiles(scalePath);
        await expect(page.locator('#fs-scale-preview')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#fs-scale-preview')).toContainText('設問名');
        await expect(page.locator('#fs-scale-preview')).toContainText('因子名');

        // データファイルをアップロード
        const dataPath = path.join(__dirname, '../datasets/factor_data_test.csv');
        await page.locator('#fs-data-file-input').setInputFiles(dataPath);
        await expect(page.locator('#fs-data-preview')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#fs-data-preview')).toContainText('Q1');
    });

    test('should calculate factor scores correctly', async ({ page }) => {
        const card = page.locator('.feature-card[data-analysis="factor_score"]');
        await card.click();
        await expect(page.locator('#analysis-area')).toBeVisible({ timeout: 10000 });

        // 両ファイルをアップロード
        const scalePath = path.join(__dirname, '../datasets/scale_info_test.csv');
        const dataPath = path.join(__dirname, '../datasets/factor_data_test.csv');
        await page.locator('#fs-scale-file-input').setInputFiles(scalePath);
        await expect(page.locator('#fs-scale-preview')).toBeVisible({ timeout: 10000 });
        await page.locator('#fs-data-file-input').setInputFiles(dataPath);
        await expect(page.locator('#fs-data-preview')).toBeVisible({ timeout: 10000 });

        // n件法を5に設定
        await page.locator('#fs-n-scale').fill('5');

        // 計算実行
        await page.locator('#fs-calculate-btn').click();

        // 結果が表示されること
        await expect(page.locator('#fs-result-section')).toBeVisible({ timeout: 10000 });

        // 因子得点のカラム名が含まれること
        await expect(page.locator('#fs-result')).toContainText('学習意欲_因子得点');
        await expect(page.locator('#fs-result')).toContainText('自己効力感_因子得点');

        // ダウンロードボタンが表示されること
        await expect(page.locator('#fs-download-section')).toBeVisible();
    });
});
