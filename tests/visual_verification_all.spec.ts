
import { test, expect } from '@playwright/test';
import { loadParamsFromConfig, navigateToFeature, uploadFile, selectStandardOption, selectVariables } from './utils/test-helpers';

test.describe('Visual Verification: All Features', () => {
    // Capture console logs
    const consoleLogs = [];

    test.beforeEach(async ({ page }) => {
        consoleLogs.length = 0; // Clear logs
        page.on('console', msg => {
            const type = msg.type();
            if (type === 'error' || type === 'warning') {
                const text = msg.text();
                // Filter out benign errors like 404s/favicons
                if (!text.includes('404') && !text.includes('favicon')) {
                    consoleLogs.push(`[${type}] ${text}`);
                    console.log(`PAGE LOG: [${type}] ${text}`);
                }
            }
        });

        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    // Helper to check errors
    const assertNoErrors = () => {
        expect(consoleLogs).toHaveLength(0);
    };

    // 1. EDA
    test('EDA: Visualization', async ({ page }) => {
        await navigateToFeature(page, 'eda');
        // Click the Two Vars tab
        await page.click('button.tab-button[data-tab="two-vars"]');

        // Select Variables using confirmed IDs
        await selectStandardOption(page, '#two-var-1', '数学', 'label');
        await selectStandardOption(page, '#two-var-2', '英語', 'label');

        await page.click('#plot-two-vars-btn');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-results/visual_verification/eda_scatter.png', fullPage: true });
        assertNoErrors();
    });

    // 2. Correlation
    test('Correlation Analysis', async ({ page }) => {
        await navigateToFeature(page, 'correlation');
        await selectVariables(page, ['数学', '英語', '理科']);
        await page.click('#run-correlation-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.screenshot({ path: 'test-results/visual_verification/correlation.png', fullPage: true });
        assertNoErrors();
    });

    // 3. Chi-Square
    test('Chi-Square Test', async ({ page }) => {
        await navigateToFeature(page, 'chi_square');
        // 'クラス' and '性別' are categorical
        await selectStandardOption(page, '#row-var', '性別', 'label');
        await selectStandardOption(page, '#col-var', 'クラス', 'label');

        await page.click('#run-chi-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.screenshot({ path: 'test-results/visual_verification/chi_square.png', fullPage: true });
        assertNoErrors();
    });

    // 4. T-Test (Independent)
    test('T-Test (Independent)', async ({ page }) => {
        await navigateToFeature(page, 'ttest');
        // Default is independent, no need to click non-existent tab button
        await selectStandardOption(page, '#group-var', '性別', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#independent-btn-container button');
        await expect(page.locator('#results-section')).toBeVisible();
        await page.screenshot({ path: 'test-results/visual_verification/ttest_independent.png', fullPage: true });
        assertNoErrors();
    });

    // 5. Mann-Whitney
    test('Mann-Whitney U Test', async ({ page }) => {
        await navigateToFeature(page, 'mann_whitney');
        await selectStandardOption(page, '#group-var', '性別', 'label'); // Group var ID confirmed

        // Multi-select for dependents: 'dep-var-multiselect-hidden'
        // Using logic to target specific multi-select hidden input if selectVariables fails?
        // Let's try selectVariables first, as there is likely only one multi-select on this page.
        await selectVariables(page, ['数学']);

        await page.click('#run-btn-container button');
        await expect(page.locator('#results-section')).toBeVisible();
        await page.screenshot({ path: 'test-results/visual_verification/mann_whitney.png', fullPage: true });
        assertNoErrors();
    });

    // 6. ANOVA One-Way
    test('ANOVA One-Way', async ({ page }) => {
        await navigateToFeature(page, 'anova_one_way');
        await selectStandardOption(page, '#factor-var', 'クラス', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#run-ind-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.screenshot({ path: 'test-results/visual_verification/anova_one_way.png', fullPage: true });
        assertNoErrors();
    });

    // 7. ANOVA Two-Way
    test('ANOVA Two-Way', async ({ page }) => {
        await navigateToFeature(page, 'anova_two_way');
        await selectStandardOption(page, '#factor1-var', 'クラス', 'label');
        await selectStandardOption(page, '#factor2-var', '性別', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#run-ind-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.screenshot({ path: 'test-results/visual_verification/anova_two_way.png', fullPage: true });
        assertNoErrors();
    });

    // 8. Simple Regression
    test('Simple Regression', async ({ page }) => {
        await navigateToFeature(page, 'regression_simple');
        // Independent (X) and Dependent (Y) - Single Selects
        await selectStandardOption(page, '#independent-var', '数学', 'label');
        await selectStandardOption(page, '#dependent-var', '理科', 'label');

        await page.click('#run-regression-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.screenshot({ path: 'test-results/visual_verification/regression_simple.png', fullPage: true });
        assertNoErrors();
    });

    // 9. Multiple Regression
    test('Multiple Regression', async ({ page }) => {
        await navigateToFeature(page, 'regression_multiple');
        // Target (Dependent) - Multi-select (but usually 1) -> #dependent-vars
        // Predictors (Independent) - Multi-select -> #independent-vars

        // Use selectStandardOption to force selection on specific hidden inputs
        await selectStandardOption(page, '#dependent-vars', '理科', 'label');
        // For multiple selection on hidden input, selectStandardOption might only select one if not adapted?
        // But here we select just one target.

        // For predictors, select multiples? '数学' and '英語'.
        // selectStandardOption only handles single value per call. Call twice?
        // HTMLSelectElement multiple=true handles additive selection if we set .selected=true without clearing others?
        // My fallback implementation: option.selected = true. It doesn't clear others. Good.
        await selectStandardOption(page, '#independent-vars', '数学', 'label');
        await selectStandardOption(page, '#independent-vars', '英語', 'label');

        await page.click('#run-regression-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.screenshot({ path: 'test-results/visual_verification/regression_multiple.png', fullPage: true });
        assertNoErrors();
    });

    // 10. PCA
    test('Principal Component Analysis', async ({ page }) => {
        await navigateToFeature(page, 'pca');
        await selectVariables(page, ['数学', '英語', '理科', '学習時間']);
        await page.click('#run-pca-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.screenshot({ path: 'test-results/visual_verification/pca.png', fullPage: true });
        assertNoErrors();
    });

    // 11. Factor Analysis
    test('Factor Analysis', async ({ page }) => {
        await navigateToFeature(page, 'factor_analysis');
        await selectVariables(page, ['数学', '英語', '理科', '学習時間']);
        await page.click('#run-factor-btn-container button');
        await expect(page.locator('#fa-analysis-results')).toBeVisible();
        await page.screenshot({ path: 'test-results/visual_verification/factor_analysis.png', fullPage: true });
        assertNoErrors();
    });

    // 12. Time Series
    test('Time Series', async ({ page }) => {
        await navigateToFeature(page, 'time_series');
        await selectStandardOption(page, '#time-var', 'ID', 'label');
        await selectStandardOption(page, '#value-var', '数学', 'label');
        await page.click('#run-btn-container button');
        await expect(page.locator('#ts-results-section')).toBeVisible();
        await page.screenshot({ path: 'test-results/visual_verification/time_series.png', fullPage: true });
        assertNoErrors();
    });

    // 13. Text Mining
    test('Text Mining', async ({ page }) => {
        await navigateToFeature(page, 'text_mining');
        const count = await page.locator('#text-col option').count();
        if (count > 0) {
            await page.selectOption('#text-col', { index: 0 });
            await page.click('#run-text-btn-container button');
            // Increase timeout for Text Mining
            await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 60000 });
            await page.screenshot({ path: 'test-results/visual_verification/text_mining.png', fullPage: true });
        }
        assertNoErrors();
    });

});
