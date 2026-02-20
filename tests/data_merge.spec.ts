// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Data Merge Feature', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));
        page.on('dialog', async dialog => {
            console.log(`DIALOG: ${dialog.message()}`);
            await dialog.dismiss();
        });

        await page.goto('http://127.0.0.1:8081/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
    });

    test('should navigate to data merge without uploading data', async ({ page }) => {
        // データ未アップロード状態でカードをクリックできること
        const card = page.locator('.feature-card[data-analysis="data_merge"]');
        await expect(card).toBeVisible();
        await card.click();

        // 分析エリアが表示されること
        await expect(page.locator('#analysis-area')).toBeVisible({ timeout: 10000 });

        // 結合機能のUIが表示されること
        await expect(page.locator('#merge-upload1')).toBeVisible();
        await expect(page.locator('#merge-upload2')).toBeVisible();
    });

    test('should upload two files and show previews', async ({ page }) => {
        // カードクリック
        const card = page.locator('.feature-card[data-analysis="data_merge"]');
        await card.click();
        await expect(page.locator('#analysis-area')).toBeVisible({ timeout: 10000 });

        // ファイル1をアップロード
        const file1Path = path.join(__dirname, '../datasets/merge_test_1.csv');
        await page.locator('#merge-file1-input').setInputFiles(file1Path);

        // プレビュー1が表示されること
        await expect(page.locator('#merge-preview1')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#merge-preview1')).toContainText('田中太郎');

        // ファイル2をアップロード
        const file2Path = path.join(__dirname, '../datasets/merge_test_2.csv');
        await page.locator('#merge-file2-input').setInputFiles(file2Path);

        // プレビュー2が表示されること
        await expect(page.locator('#merge-preview2')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#merge-preview2')).toContainText('山田次郎');
    });

    test('should detect common columns and merge data', async ({ page }) => {
        // カードクリック
        const card = page.locator('.feature-card[data-analysis="data_merge"]');
        await card.click();
        await expect(page.locator('#analysis-area')).toBeVisible({ timeout: 10000 });

        // 2ファイルをアップロード
        const file1Path = path.join(__dirname, '../datasets/merge_test_1.csv');
        const file2Path = path.join(__dirname, '../datasets/merge_test_2.csv');
        await page.locator('#merge-file1-input').setInputFiles(file1Path);
        await expect(page.locator('#merge-preview1')).toBeVisible({ timeout: 10000 });

        await page.locator('#merge-file2-input').setInputFiles(file2Path);
        await expect(page.locator('#merge-preview2')).toBeVisible({ timeout: 10000 });

        // 共通カラム選択UIが表示されること
        const keySelect = page.locator('#merge-key-column');
        await expect(keySelect).toBeVisible();

        // 共通カラムが選択肢に含まれること（ID, 名前）
        const options = keySelect.locator('option');
        const optionTexts = await options.allTextContents();
        expect(optionTexts).toContain('ID');
        expect(optionTexts).toContain('名前');

        // キーカラムを選択してinner結合を実行
        await keySelect.selectOption('ID');
        await page.locator('#merge-join-type').selectOption('inner');
        await page.locator('#run-merge-btn').click();

        // 結果テーブルが表示されること
        await expect(page.locator('#merge-result')).toBeVisible({ timeout: 10000 });

        // inner結合なのでID 1,2,3のみ（3行）
        await expect(page.locator('#merge-result')).toContainText('田中太郎');
        await expect(page.locator('#merge-result')).toContainText('鈴木花子');
        await expect(page.locator('#merge-result')).toContainText('佐藤一郎');

        // ダウンロードボタンが表示されること
        await expect(page.locator('#merge-download-btn')).toBeVisible();
    });

    test('should perform outer join correctly', async ({ page }) => {
        // カードクリック
        const card = page.locator('.feature-card[data-analysis="data_merge"]');
        await card.click();
        await expect(page.locator('#analysis-area')).toBeVisible({ timeout: 10000 });

        // 2ファイルをアップロード
        const file1Path = path.join(__dirname, '../datasets/merge_test_1.csv');
        const file2Path = path.join(__dirname, '../datasets/merge_test_2.csv');
        await page.locator('#merge-file1-input').setInputFiles(file1Path);
        await expect(page.locator('#merge-preview1')).toBeVisible({ timeout: 10000 });

        await page.locator('#merge-file2-input').setInputFiles(file2Path);
        await expect(page.locator('#merge-preview2')).toBeVisible({ timeout: 10000 });

        // outer結合を実行
        await page.locator('#merge-key-column').selectOption('ID');
        await page.locator('#merge-join-type').selectOption('outer');
        await page.locator('#run-merge-btn').click();

        // 結果テーブルが表示されること
        await expect(page.locator('#merge-result')).toBeVisible({ timeout: 10000 });

        // outer結合なので全7人分のデータ
        await expect(page.locator('#merge-result')).toContainText('田中太郎');
        await expect(page.locator('#merge-result')).toContainText('高橋美咲');
        await expect(page.locator('#merge-result')).toContainText('山田次郎');
    });

    test('should use custom suffixes for overlapping columns', async ({ page }) => {
        // カードクリック
        const card = page.locator('.feature-card[data-analysis="data_merge"]');
        await card.click();
        await expect(page.locator('#analysis-area')).toBeVisible({ timeout: 10000 });

        // 2ファイルをアップロード
        const file1Path = path.join(__dirname, '../datasets/merge_test_1.csv');
        const file2Path = path.join(__dirname, '../datasets/merge_test_2.csv');
        await page.locator('#merge-file1-input').setInputFiles(file1Path);
        await expect(page.locator('#merge-preview1')).toBeVisible({ timeout: 10000 });

        await page.locator('#merge-file2-input').setInputFiles(file2Path);
        await expect(page.locator('#merge-preview2')).toBeVisible({ timeout: 10000 });

        // カスタムサフィックスを入力
        await page.locator('#merge-suffix1').fill('前');
        await page.locator('#merge-suffix2').fill('後');

        // inner結合を実行
        await page.locator('#merge-key-column').selectOption('ID');
        await page.locator('#run-merge-btn').click();

        // 結果テーブルに「名前_前」「名前_後」が表示されること
        await expect(page.locator('#merge-result')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#merge-result')).toContainText('名前_前');
        await expect(page.locator('#merge-result')).toContainText('名前_後');
    });
});
