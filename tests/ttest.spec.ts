
import { test, expect } from '@playwright/test';
import { selectVariables, selectStandardOption } from './utils/test-helpers';
import * as path from 'path';

test.describe('T-Test Feature', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#main-upload-btn')).toBeEnabled({ timeout: 30000 });
    });


    test('should run Independent T-Test successfully', async ({ page }) => {
        // 1. デモデータをロード
        const fileInput = page.locator('#main-data-file');
        const filePath = path.join(__dirname, '../datasets/ttest_demo.xlsx');
        const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible' });
        await fileInput.setInputFiles(filePath);
        await previewVisiblePromise;

        // 2. T検定カードをクリック
        const tTestCard = page.locator('.feature-card[data-analysis="ttest"]');
        await expect(tTestCard).toBeVisible();
        await tTestCard.click();

        // 3. 分析画面確認
        await expect(page.locator('#analysis-area')).toBeVisible();
        await page.waitForSelector('.ttest-container', { state: 'visible', timeout: 10000 });

        // 4. 変数選択（独立なサンプルのt検定）
        // グループ変数: 組
        await selectStandardOption(page, '#group-var', '組', 'label');

        // 検定変数: 数学 (MultiSelect)
        await selectVariables(page, ['数学']);

        // 5. 分析実行
        await page.click('#run-independent-btn');

        // 6. 結果検証 - wait for results to be visible
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });

        // t検定結果の統合テーブルの内容を確認
        const textContent = await page.locator('#results-section').textContent();
        expect(textContent).toContain('変数');
        expect(textContent).toContain('平均');
        expect(textContent).toContain('SD');
        expect(textContent).toContain('t');
        expect(textContent).toContain('df');
        expect(textContent).toContain('p');
        expect(textContent).toContain('効果量(d)');
        expect(textContent).toContain('95% CI');

        // テーブルが横に並んでいる（1つのテーブルにまとまっている）ことを確認
        const tableHeaders = await page.locator('#results-section table.analysis-table th').allTextContents();
        expect(tableHeaders.length).toBeGreaterThan(5); // 統合テーブルなら多数のヘッダーがあるはず
    });

    test('should run Paired T-Test successfully', async ({ page }) => {
        // 1. デモデータをロード
        const fileInput = page.locator('#main-data-file');
        const filePath = path.join(__dirname, '../datasets/ttest_demo.xlsx');
        const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible' });
        await fileInput.setInputFiles(filePath);
        await previewVisiblePromise;

        // 2. T検定カードをクリック
        const tTestCard = page.locator('.feature-card[data-analysis="ttest"]');
        await tTestCard.click();
        await page.waitForSelector('.ttest-container', { state: 'visible', timeout: 10000 });

        // 3. 対応ありt検定タブを選択（ラジオボタンをクリック）
        const pairedRadio = page.locator('input[name="test-type"][value="paired"]');
        await pairedRadio.click();
        // Wait for paired controls to be visible
        await page.waitForSelector('#paired-controls', { state: 'visible', timeout: 5000 });

        // 4. 変数ペア選択（対応ありのt検定）
        await selectStandardOption(page, '#paired-var-pre', '英語', 'label');
        await selectStandardOption(page, '#paired-var-post', '数学', 'label');

        // 5. ペアを追加（必須）
        await page.click('#add-pair-btn');

        // 6. 分析実行
        await page.click('#run-paired-btn');

        // 6. 結果検証
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });

        // t検定結果の統合テーブルの内容を確認
        const textContent = await page.locator('#results-section').textContent();
        expect(textContent).toContain('ペア'); // or 変数
        expect(textContent).toContain('平均');
        expect(textContent).toContain('SD');
        expect(textContent).toContain('t');
        expect(textContent).toContain('df');
        expect(textContent).toContain('p');
        expect(textContent).toContain('効果量(dz)');
        expect(textContent).toContain('95% CI');
    });
});
