
import { test, expect } from '@playwright/test';
import { loadParamsFromConfig, navigateToFeature, uploadFile, selectOptionRobust } from './utils/test-helpers';

test.describe('EDA Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
        await navigateToFeature(page, 'eda');
    });

    test('should generate EDA summary successfully', async ({ page }) => {
        // EDA runs automatically on load for summary stats
        await expect(page.locator('#eda-summary-stats')).toBeVisible({ timeout: 10000 });

        const summaryText = await page.locator('#eda-summary-stats').textContent();
        expect(summaryText).toContain('要約統計量');
        expect(summaryText).toContain('数値変数の統計量');

        // Check for basic plots (Numeric Visualization Section)
        await expect(page.locator('#numeric-viz-section')).toBeVisible();
    });

    test('should run 2-variable analysis', async ({ page }) => {
        // Switch to Two-Variables tab
        await page.click('button[data-tab="two-vars"]');
        await expect(page.locator('#two-variables-viz-section')).toBeVisible();

        // Select variables
        await selectOptionRobust(page, '#two-var-1', '数学');
        await selectOptionRobust(page, '#two-var-2', '理科');

        // Run 2-var analysis
        await page.click('#plot-two-vars-btn');

        // Check result
        const resultArea = page.locator('#two-vars-result');
        await expect(resultArea).toBeVisible();
        await expect(resultArea).toContainText('相関係数');
        await expect(resultArea).toContainText('散布図');
    });
});
