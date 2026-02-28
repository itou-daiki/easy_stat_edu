/**
 * 包括的ビジュアルチェック: 全機能の動作確認と図表サイズ検証
 * スクリーンショットを撮影し、グラフサイズ・テーブル幅を数値検証
 */
import { test, expect, Page } from '@playwright/test';
import { navigateToFeature, uploadFile, selectStandardOption, selectVariables } from './utils/test-helpers';

// ビューポートを固定して図表サイズを一貫して検証
test.use({ viewport: { width: 1280, height: 900 } });

const SCREENSHOT_DIR = 'test-results/comprehensive_visual';

/** Plotlyグラフのサイズを取得 */
async function getPlotlyDimensions(page: Page, selector: string = '.js-plotly-plot') {
    return await page.evaluate((sel) => {
        const plots = document.querySelectorAll(sel);
        return Array.from(plots).map((plot, i) => {
            const rect = plot.getBoundingClientRect();
            return { index: i, width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 };
        });
    }, selector);
}

/** テーブルのサイズを取得 */
async function getTableDimensions(page: Page) {
    return await page.evaluate(() => {
        const tables = document.querySelectorAll('table');
        return Array.from(tables).map((table, i) => {
            const rect = table.getBoundingClientRect();
            const container = table.closest('.table-container, [style*="overflow"]');
            const containerRect = container ? container.getBoundingClientRect() : null;
            const isOverflowing = container ? table.scrollWidth > container.clientWidth : false;
            return {
                index: i,
                width: rect.width,
                height: rect.height,
                containerWidth: containerRect?.width ?? null,
                isOverflowing,
                visible: rect.width > 0 && rect.height > 0
            };
        });
    });
}

/** コンソールエラーを収集 */
function setupConsoleLogs(page: Page) {
    const errors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const text = msg.text();
            if (!text.includes('404') && !text.includes('favicon') && !text.includes('net::ERR')) {
                errors.push(text);
            }
        }
    });
    page.on('pageerror', err => {
        errors.push(`PageError: ${err.message}`);
    });
    return errors;
}

// =============================================
// Group 1: 基本統計・EDA・相関
// =============================================
test.describe('Visual Check Group 1: 基本統計', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = setupConsoleLogs(page);
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('EDA - 一変量', async ({ page }) => {
        await navigateToFeature(page, 'eda');
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/01_eda_initial.png`, fullPage: true });

        // 一変量タブはデフォルト
        const plots = await getPlotlyDimensions(page);
        // Check for reasonably sized plots (if any)
        for (const plot of plots) {
            if (plot.visible) {
                expect(plot.width, `EDA plot ${plot.index} width`).toBeGreaterThan(200);
                expect(plot.height, `EDA plot ${plot.index} height`).toBeGreaterThan(100);
            }
        }
        expect(errors).toHaveLength(0);
    });

    test('EDA - 二変量散布図', async ({ page }) => {
        await navigateToFeature(page, 'eda');
        await page.click('button.tab-button[data-tab="two-vars"]');
        await selectStandardOption(page, '#two-var-1', '数学', 'label');
        await selectStandardOption(page, '#two-var-2', '英語', 'label');
        await page.click('#plot-two-vars-btn');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/02_eda_scatter.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        const visiblePlots = plots.filter(p => p.visible);
        expect(visiblePlots.length, 'EDA scatter should have visible plot').toBeGreaterThan(0);
        for (const plot of visiblePlots) {
            expect(plot.width, 'EDA scatter width too small').toBeGreaterThan(300);
            expect(plot.height, 'EDA scatter height too small').toBeGreaterThan(200);
            expect(plot.width, 'EDA scatter width too large').toBeLessThan(1300);
        }
        expect(errors).toHaveLength(0);
    });

    test('相関分析', async ({ page }) => {
        await navigateToFeature(page, 'correlation');
        await selectVariables(page, ['数学', '英語', '理科']);
        await page.click('#run-correlation-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/03_correlation.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        const visiblePlots = plots.filter(p => p.visible);
        expect(visiblePlots.length, 'Correlation should have plots').toBeGreaterThan(0);
        for (const plot of visiblePlots) {
            expect(plot.width, `Correlation plot ${plot.index} width`).toBeGreaterThan(200);
            expect(plot.width, `Correlation plot ${plot.index} too wide`).toBeLessThan(1300);
        }
        const tables = await getTableDimensions(page);
        for (const t of tables.filter(t => t.visible)) {
            expect(t.isOverflowing, `Table ${t.index} overflows container`).toBe(false);
        }
        expect(errors).toHaveLength(0);
    });

    test('クロス集計表', async ({ page }) => {
        await navigateToFeature(page, 'cross_tabulation');
        await selectStandardOption(page, '#crosstab-row-var', '性別', 'label');
        await selectStandardOption(page, '#crosstab-col-var', 'クラス', 'label');
        await page.click('#run-crosstab-btn', { force: true });
        await expect(page.locator('#crosstab-analysis-results')).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/04_cross_tabulation.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });
});

// =============================================
// Group 2: t検定・ノンパラ検定
// =============================================
test.describe('Visual Check Group 2: t検定・ノンパラ', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = setupConsoleLogs(page);
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('独立サンプルt検定', async ({ page }) => {
        await navigateToFeature(page, 'ttest');
        await selectStandardOption(page, '#group-var', '性別', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#independent-btn-container button');
        await expect(page.locator('#results-section')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/05_ttest_independent.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        for (const plot of plots.filter(p => p.visible)) {
            expect(plot.width, 'T-test plot width').toBeGreaterThan(300);
            expect(plot.height, 'T-test plot height').toBeGreaterThan(150);
            expect(plot.width, 'T-test plot too wide').toBeLessThan(1300);
        }
        expect(errors).toHaveLength(0);
    });

    test('対応ありt検定', async ({ page }) => {
        await navigateToFeature(page, 'ttest');
        await page.click('input[name="test-type"][value="paired"]');
        await page.waitForTimeout(500);
        // Paired t-test uses pair selector: select pre/post then add pair
        await selectStandardOption(page, '#paired-var-pre', '数学', 'label');
        await selectStandardOption(page, '#paired-var-post', '英語', 'label');
        await page.click('#add-pair-btn', { force: true });
        await page.waitForTimeout(300);
        await page.click('#run-paired-btn', { force: true });
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/06_ttest_paired.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('1標本t検定', async ({ page }) => {
        await navigateToFeature(page, 'ttest');
        await page.click('input[name="test-type"][value="one-sample"]');
        await page.waitForTimeout(500);
        await selectStandardOption(page, '#one-sample-var', '数学', 'label');
        await page.fill('#one-sample-mu', '60');
        await page.click('#run-one-sample-btn', { force: true });
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/07_ttest_one_sample.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('Mann-Whitney U検定', async ({ page }) => {
        await navigateToFeature(page, 'mann_whitney');
        await selectStandardOption(page, '#group-var', '性別', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#run-btn-container button');
        await expect(page.locator('#results-section')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/08_mann_whitney.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        for (const plot of plots.filter(p => p.visible)) {
            expect(plot.width, 'Mann-Whitney plot width').toBeGreaterThan(300);
            expect(plot.width, 'Mann-Whitney plot too wide').toBeLessThan(1300);
        }
        expect(errors).toHaveLength(0);
    });

    test('Wilcoxon符号付順位検定', async ({ page }) => {
        await navigateToFeature(page, 'wilcoxon_signed_rank');
        await selectVariables(page, ['数学', '英語']);
        await page.click('#run-wilcoxon-test-btn', { force: true });
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/09_wilcoxon.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('Kruskal-Wallis検定', async ({ page }) => {
        await navigateToFeature(page, 'kruskal_wallis');
        await selectStandardOption(page, '#group-var', 'クラス', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#run-btn-container button');
        await expect(page.locator('#results-section')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/10_kruskal_wallis.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });
});

// =============================================
// Group 3: ANOVA系
// =============================================
test.describe('Visual Check Group 3: ANOVA', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = setupConsoleLogs(page);
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('一元配置ANOVA（独立）', async ({ page }) => {
        await navigateToFeature(page, 'anova_one_way');
        await selectStandardOption(page, '#factor-var', 'クラス', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#run-ind-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/11_anova_one_way_ind.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        for (const plot of plots.filter(p => p.visible)) {
            expect(plot.width, 'ANOVA plot width').toBeGreaterThan(300);
            expect(plot.width, 'ANOVA plot too wide').toBeLessThan(1300);
        }
        expect(errors).toHaveLength(0);
    });

    test('一元配置ANOVA（反復測定）', async ({ page }) => {
        await navigateToFeature(page, 'anova_one_way');
        await page.click('input[name="anova-type"][value="repeated"]');
        await page.waitForTimeout(300);
        await selectVariables(page, ['数学', '英語', '理科']);
        await page.click('#run-rep-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/12_anova_one_way_rep.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('二元配置ANOVA（独立）', async ({ page }) => {
        await navigateToFeature(page, 'anova_two_way');
        await selectStandardOption(page, '#factor1-var', 'クラス', 'label');
        await selectStandardOption(page, '#factor2-var', '性別', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#run-ind-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/13_anova_two_way_ind.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('二元配置ANOVA（混合）', async ({ page }) => {
        await navigateToFeature(page, 'anova_two_way');
        await page.click('input[name="anova-2-type"][value="mixed"]');
        await page.waitForTimeout(500);
        await selectStandardOption(page, '#mixed-between-var', '性別', 'label');
        const pairRow = page.locator('.pair-row').first();
        await pairRow.locator('.pre-select').selectOption({ label: '数学' });
        await pairRow.locator('.post-select').selectOption({ label: '英語' });
        await page.click('#run-mixed-anova-btn', { force: true });
        await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/14_anova_two_way_mixed.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });
});

// =============================================
// Group 4: カテゴリカル分析
// =============================================
test.describe('Visual Check Group 4: カテゴリカル', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = setupConsoleLogs(page);
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('カイ二乗検定', async ({ page }) => {
        await navigateToFeature(page, 'chi_square');
        await selectStandardOption(page, '#row-var', '性別', 'label');
        await selectStandardOption(page, '#col-var', 'クラス', 'label');
        await page.click('#run-chi-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/15_chi_square.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('Fisher正確検定', async ({ page }) => {
        await navigateToFeature(page, 'fisher_exact');
        await selectStandardOption(page, '#row-var', '性別', 'label');
        await selectStandardOption(page, '#col-var', 'クラス', 'label');
        await page.click('#run-fisher-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/16_fisher_exact.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('McNemar検定', async ({ page }) => {
        // McNemar needs different dataset
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/mcnemar_test.csv');
        await navigateToFeature(page, 'mcnemar');
        await selectStandardOption(page, '#mcnemar-var1', '授業前理解', 'label');
        await selectStandardOption(page, '#mcnemar-var2', '授業後理解', 'label');
        await page.click('#run-mcnemar-btn', { force: true });
        await expect(page.locator('#mcnemar-analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/17_mcnemar.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });
});

// =============================================
// Group 5: 回帰・多変量・テキスト
// =============================================
test.describe('Visual Check Group 5: 回帰・多変量', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = setupConsoleLogs(page);
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('単回帰分析', async ({ page }) => {
        await navigateToFeature(page, 'regression_simple');
        await selectStandardOption(page, '#independent-var', '数学', 'label');
        await selectStandardOption(page, '#dependent-var', '理科', 'label');
        await page.click('#run-regression-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/18_regression_simple.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        for (const plot of plots.filter(p => p.visible)) {
            expect(plot.width, 'Regression plot width').toBeGreaterThan(300);
            expect(plot.width, 'Regression plot too wide').toBeLessThan(1300);
        }
        expect(errors).toHaveLength(0);
    });

    test('重回帰分析', async ({ page }) => {
        await navigateToFeature(page, 'regression_multiple');
        await selectStandardOption(page, '#dependent-vars', '理科', 'label');
        await selectStandardOption(page, '#independent-vars', '数学', 'label');
        await selectStandardOption(page, '#independent-vars', '英語', 'label');
        await page.click('#run-regression-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/19_regression_multiple.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('ロジスティック回帰', async ({ page }) => {
        test.setTimeout(60000);
        await navigateToFeature(page, 'logistic_regression');
        await page.waitForTimeout(1000);
        // outcome: binary variable
        await selectStandardOption(page, '#logistic-dep-var', '性別', 'label');
        await page.waitForTimeout(300);
        await selectVariables(page, ['数学', '英語']);
        await page.waitForTimeout(300);
        await page.click('#run-logistic-btn', { force: true });
        await expect(page.locator('#logistic-analysis-results')).toBeVisible({ timeout: 30000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/20_logistic_regression.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('主成分分析 (PCA)', async ({ page }) => {
        await navigateToFeature(page, 'pca');
        await selectVariables(page, ['数学', '英語', '理科', '学習時間']);
        await page.click('#run-pca-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/21_pca.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        for (const plot of plots.filter(p => p.visible)) {
            expect(plot.width, 'PCA plot width').toBeGreaterThan(200);
            expect(plot.width, 'PCA plot too wide').toBeLessThan(1300);
        }
        expect(errors).toHaveLength(0);
    });

    test('因子分析', async ({ page }) => {
        await navigateToFeature(page, 'factor_analysis');
        await selectVariables(page, ['数学', '英語', '理科', '学習時間']);
        await page.click('#run-factor-btn-container button');
        await expect(page.locator('#fa-analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/22_factor_analysis.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('時系列分析', async ({ page }) => {
        await navigateToFeature(page, 'time_series');
        await selectStandardOption(page, '#time-var', 'ID', 'label');
        await selectStandardOption(page, '#value-var', '数学', 'label');
        await page.click('#run-btn-container button');
        await expect(page.locator('#ts-results-section')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/23_time_series.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        for (const plot of plots.filter(p => p.visible)) {
            expect(plot.width, 'Time series plot width').toBeGreaterThan(300);
            expect(plot.width, 'Time series plot too wide').toBeLessThan(1300);
        }
        expect(errors).toHaveLength(0);
    });

    test('テキストマイニング', async ({ page }) => {
        await navigateToFeature(page, 'text_mining');
        const count = await page.locator('#text-col option').count();
        if (count > 0) {
            await page.selectOption('#text-col', { index: 0 });
            await page.click('#run-text-btn-container button');
            await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 60000 });
            await page.waitForTimeout(1000);
            await page.screenshot({ path: `${SCREENSHOT_DIR}/24_text_mining.png`, fullPage: true });
        }
        expect(errors).toHaveLength(0);
    });
});
