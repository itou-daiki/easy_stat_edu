
import { test, expect } from '@playwright/test';
import { selectVariables, selectStandardOption } from './utils/test-helpers';

test.describe('T-Test Feature', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:8081/');
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
        await expect(page.locator('#analysis-area h3').filter({ hasText: 't検定' })).toBeVisible();

        // 4. 変数選択（独立なサンプルのt検定）
        // グループ変数: 性別 (index 1)
        await selectStandardOption(page, 'group-var', '1', 'index');

        // 検定変数: 数学 (MultiSelect)
        // Note: T-Test implementation uses a custom multiselect for dependent variables
        await selectVariables(page, ['数学']);

        // 5. 分析実行
        await page.click('#run-independent-btn');

        // 6. 結果検証
        await expect(page.locator('#results-section')).toBeVisible();

        // 要約統計量
        await expect(page.locator('#summary-stats-section')).toBeVisible();

        // t検定結果テーブル
        const resultsTable = page.locator('#test-results-section table');
        await expect(resultsTable).toBeVisible();
        await expect(resultsTable).toContainText('t値');
        await expect(resultsTable).toContainText('p値');
        await expect(resultsTable).toContainText('Cohens d'); // 効果量チェック

        // 可視化（箱ひげ図など）
        await expect(page.locator('#visualization-section .js-plotly-plot')).toBeVisible();
    });

    test('should run Paired T-Test successfully', async ({ page }) => {
        // 1. デモデータをロード
        await page.click('#load-demo-btn');
        await page.waitForSelector('#dataframe-container', { state: 'visible' });

        // 2. T検定カードをクリック
        const tTestCard = page.locator('.feature-card[data-analysis="ttest"]');
        await tTestCard.click();

        // 3. 対応のあるt検定タブに切り替え
        await page.click('button[data-tab="paired"]');
        await expect(page.locator('#tab-paired')).toBeVisible();

        // 4. ペア変数選択
        // 変数A: 数学, 変数B: 英語
        await selectStandardOption(page, 'pair-var1-0', '1', 'index'); // 数学 (assuming index 1)
        await selectStandardOption(page, 'pair-var2-0', '3', 'index'); // 英語 (assuming index 3, need to check data)
        // index logic matches standard selects in demo data context

        // 5. 分析実行
        await page.click('#run-paired-btn');

        // 6. 結果検証
        await expect(page.locator('#results-section')).toBeVisible();
        await expect(page.locator('#summary-stats-section')).toBeVisible();

        const resultsTable = page.locator('#test-results-section table');
        await expect(resultsTable).toBeVisible();
        await expect(resultsTable).toContainText('差の平均');
        await expect(resultsTable).toContainText('t値');

        // 可視化
        await expect(page.locator('#visualization-section .js-plotly-plot')).toBeVisible();
    });
});
