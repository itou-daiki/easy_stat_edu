
import { test, expect } from '@playwright/test';
import { loadParamsFromConfig, navigateToFeature, uploadFile, selectStandardOption, selectVariables } from './utils/test-helpers';

test.describe('Regression Analysis Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('should run Simple Regression successfully', async ({ page }) => {
        await navigateToFeature(page, 'regression_simple');

        // Simple Regression uses single selects
        await selectStandardOption(page, '#dependent-var', '数学', 'label');
        await selectStandardOption(page, '#independent-var', '英語', 'label');

        await page.click('#run-regression-btn');

        await expect(page.locator('#regression-results')).toBeVisible({ timeout: 30000 });
        const textContent = await page.locator('#regression-results').textContent();
        expect(textContent).toContain('回帰式');
        expect(textContent).toContain('決定係数');

        await expect(page.locator('#regression-plot')).toBeVisible();
        // Note: Plot container ID might vary, usually it's dynamic or inside results
    });

    test('should run Multiple Regression successfully', async ({ page }) => {
        await navigateToFeature(page, 'regression_multiple');

        // Multiple Regression dependent var allows multiple! Use selectVariables
        await selectVariables(page, ['数学']);
        // Need to check if #dependent-var is handled by selectVariables (it checks input[value] or select options).
        // Since createVariableSelector makes a custom UI if multiple=true?
        // Let's assume createVariableSelector with multiple:true uses the custom multiselect class logic.
        // If so, selectVariables helper should handle it.
        // Wait, '数学' is the value.

        // Independent vars (multiple)
        await selectVariables(page, ['英語', '理科']);

        await page.click('#run-regression-btn');

        await expect(page.locator('#regression-results')).toBeVisible({ timeout: 30000 });
        const textContent = await page.locator('#regression-results').textContent();
        expect(textContent).toContain('偏回帰係数');
        expect(textContent).toContain('自由度修正済み決定係数');
    });
});
