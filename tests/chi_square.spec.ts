
import { test, expect } from '@playwright/test';
import { loadParamsFromConfig, navigateToFeature, uploadFile, selectStandardOption } from './utils/test-helpers';

function createBorderlineChiSquareCsv() {
    const counts = [
        ['1年', '標準（6〜8時間）', 20],
        ['1年', '短い（6時間未満）', 5],
        ['1年', '長い（8時間以上）', 10],
        ['2年', '標準（6〜8時間）', 14],
        ['2年', '短い（6時間未満）', 8],
        ['2年', '長い（8時間以上）', 7],
        ['3年', '標準（6〜8時間）', 18],
        ['3年', '短い（6時間未満）', 15],
        ['3年', '長い（8時間以上）', 3],
    ];
    const rows = ['学年,睡眠時間カテゴリ'];

    counts.forEach(([grade, sleepCategory, count]) => {
        for (let i = 0; i < Number(count); i++) {
            rows.push(`${grade},${sleepCategory}`);
        }
    });

    return rows.join('\n');
}

function createYatesBorderlineCsv() {
    const rows = ['群,結果'];
    [
        ['A', 'あり', 2],
        ['A', 'なし', 8],
        ['B', 'あり', 13],
        ['B', 'なし', 7],
    ].forEach(([group, outcome, count]) => {
        for (let i = 0; i < Number(count); i++) rows.push(`${group},${outcome}`);
    });
    return rows.join('\n');
}

test.describe('Chi-Square Test Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
        await navigateToFeature(page, 'chi_square');
    });

    test('should run Chi-Square test successfully', async ({ page }) => {
        // Wait for analysis to render
        await page.waitForSelector('.chisquare-container', { state: 'visible', timeout: 10000 });
        await expect(page.locator('#row-var')).toBeVisible();

        // Select categorical variables - using available variables
        // Row: 性別, Col: クラス
        await selectStandardOption(page, '#row-var', '性別', 'label');
        await selectStandardOption(page, '#col-var', 'クラス', 'label');

        // Run analysis
        await page.click('#run-chi-btn');

        // Check for results
        await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 10000 });

        // Check for specific output elements
        const textContent = await page.locator('#analysis-results').textContent();
        expect(textContent).toContain('カイ二乗'); // "Chi-square" in Japanese
        expect(textContent).toContain('p値'); // "p-value"
        expect(textContent).toContain('クラメールのV');
    });

    test('should keep one visualization control set after repeated analysis', async ({ page }) => {
        await selectStandardOption(page, '#row-var', '性別', 'label');
        await selectStandardOption(page, '#col-var', 'クラス', 'label');

        const runButton = page.locator('#run-chi-btn');
        await runButton.click();
        await expect(page.locator('#show-axis-labels')).toHaveCount(1);
        await page.locator('#show-axis-labels').uncheck();

        await runButton.click();
        await runButton.click();

        await expect(page.locator('#visualization-controls-container')).toHaveCount(1);
        await expect(page.locator('#show-axis-labels')).toHaveCount(1);
        await expect(page.locator('#show-graph-title')).toHaveCount(1);
        await expect(page.getByText('軸ラベルを表示', { exact: true })).toHaveCount(1);
        await expect(page.getByText('グラフタイトルを表示', { exact: true })).toHaveCount(1);
        await expect(page.locator('#show-axis-labels')).not.toBeChecked();
    });

    test('should treat large residuals as exploratory when omnibus test is not significant', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await page.locator('#main-data-file').setInputFiles({
            name: 'chi_square_borderline.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(createBorderlineChiSquareCsv(), 'utf8'),
        });
        await navigateToFeature(page, 'chi_square');

        await selectStandardOption(page, '#row-var', '学年', 'label');
        await selectStandardOption(page, '#col-var', '睡眠時間カテゴリ', 'label');
        await page.click('#run-chi-btn');

        await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#analysis-results')).toContainText('関連は、今回のデータでは統計上はっきりしませんでした');
        await expect(page.locator('#analysis-results')).toContainText('5%基準では「関連あり」と判断しません');
        await expect(page.locator('#analysis-results')).toContainText('有意な偏りとは断定しません');
        await expect(page.locator('#analysis-results')).not.toContainText('z > 1.96 (青) は有意に多い');

        const residualCells = page.locator('#analysis-results table').first().locator('td');
        const highlightCounts = await residualCells.evaluateAll(cells => {
            const backgrounds = cells.map(cell => getComputedStyle(cell).backgroundColor);
            return {
                exploratory: backgrounds.filter(color => color === 'rgb(254, 243, 199)').length,
                significantHigh: backgrounds.filter(color => color === 'rgb(219, 234, 254)').length,
                significantLow: backgrounds.filter(color => color === 'rgb(254, 226, 226)').length,
            };
        });

        expect(highlightCounts.exploratory).toBeGreaterThan(0);
        expect(highlightCounts.significantHigh).toBe(0);
        expect(highlightCounts.significantLow).toBe(0);
    });

    test('should use Yates correction as the primary result for a 2x2 table', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await page.locator('#main-data-file').setInputFiles({
            name: 'chi_square_yates_borderline.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(createYatesBorderlineCsv(), 'utf8'),
        });
        await navigateToFeature(page, 'chi_square');

        await selectStandardOption(page, '#row-var', '群', 'label');
        await selectStandardOption(page, '#col-var', '結果', 'label');
        await page.click('#run-chi-btn');

        const results = page.locator('#analysis-results');
        await expect(results).toBeVisible();
        const primaryCard = results.locator('.data-stat-card', { hasText: 'カイ二乗値' });
        await expect(primaryCard).toContainText('Yates補正');
        await expect(primaryCard.locator('.stat-value')).toHaveText('3.75');
        await expect(results.locator('.data-stat-card', { hasText: 'p値' }).locator('.stat-value')).toContainText('0.0528');
        await expect(results.locator('.data-stat-card', { hasText: 'Pearson χ²' })).toContainText('5.40');
        await expect(results).toContainText('関連は、今回のデータでは統計上はっきりしませんでした');
        await expect(results).toContainText('この結果だけで「互いに無関係」とは決められません');
    });
});
