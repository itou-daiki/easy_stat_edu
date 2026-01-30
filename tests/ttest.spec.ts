
import { test, expect } from '@playwright/test';
import { selectVariables, selectStandardOption } from './utils/test-helpers';

test.describe('T-Test Feature', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#load-demo-btn', { state: 'visible' });
    });


    test('should run Independent T-Test successfully', async ({ page }) => {
        // 1. デモデータをロード
        await page.click('#load-demo-btn');
        await page.waitForSelector('#dataframe-container', { state: 'visible' });

        // 2. T検定カードをクリック
        const tTestCard = page.locator('.feature-card[data-analysis="ttest"]');
        await expect(tTestCard).toBeVisible();
        await tTestCard.click();

        // 3. 分析画面確認
        await expect(page.locator('#analysis-area')).toBeVisible();
        await page.waitForSelector('.ttest-container', { state: 'visible', timeout: 10000 });

        // 4. 変数選択（独立なサンプルのt検定）
        // グループ変数: 性別
        await selectStandardOption(page, '#group-var', '性別', 'label');

        // 検定変数: 数学 (MultiSelect)
        await selectVariables(page, ['数学']);

        // 5. 分析実行
        await page.click('#run-independent-btn');

        // 6. 結果検証 - wait for results to be visible
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });

        // t検定結果テーブルの内容を確認 - check for actual table headers
        const textContent = await page.locator('#results-section').textContent();
        expect(textContent).toContain('t'); // Table has 't' column
        expect(textContent).toContain('p'); // Table has 'p' column
    });

    test('should run Paired T-Test successfully', async ({ page }) => {
        // 1. デモデータをロード
        await page.click('#load-demo-btn');
        await page.waitForSelector('#dataframe-container', { state: 'visible' });

        // 2. T検定カードをクリック
        const tTestCard = page.locator('.feature-card[data-analysis="ttest"]');
        await tTestCard.click();
        await page.waitForSelector('.ttest-container', { state: 'visible', timeout: 10000 });

        // 3. 対応ありt検定タブを選択（ラジオボタンをクリック）
        const pairedRadio = page.locator('input[name="test-type"][value="paired"]');
        await pairedRadio.click();
        // Wait for paired controls to be visible
        await page.waitForSelector('#paired-controls', { state: 'visible', timeout: 5000 });

        // 4. ペア変数選択 (Pre: 数学, Post: 英語)
        await selectStandardOption(page, '#paired-var-pre', '数学', 'label');
        await selectStandardOption(page, '#paired-var-post', '英語', 'label');

        // 5. ペアを追加（必須）
        await page.click('#add-pair-btn');

        // 6. 分析実行
        await page.click('#run-paired-btn');

        // 6. 結果検証
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });

        const textContent = await page.locator('#results-section').textContent();
        expect(textContent).toContain('t'); // Table has 't' column
        expect(textContent).toContain('p'); // Table has 'p' column
    });
});
