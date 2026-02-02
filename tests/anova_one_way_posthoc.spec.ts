
import { test, expect } from '@playwright/test';
import { loadParamsFromConfig, navigateToFeature, uploadFile, selectStandardOption, selectVariables } from './utils/test-helpers';

test.describe('ANOVA One-Way Post-Hoc Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
        await navigateToFeature(page, 'anova_one_way');
    });

    test('should running Tukey post-hoc test by default', async ({ page }) => {
        await page.waitForSelector('.anova-container', { state: 'visible' });

        // Select Variables
        await selectStandardOption(page, '#factor-var', 'クラス', 'label');
        await selectVariables(page, ['数学']);

        // Check default method is Tukey
        await expect(page.locator('#comparison-method')).toHaveValue('tukey');

        await page.click('#run-ind-anova-btn');

        await expect(page.locator('#analysis-results')).toBeVisible();

        // Verify Post-hoc table
        const postHocHeader = page.locator('div', { hasText: '多重比較結果 (Tukey-Kramer法' }).first();
        await expect(postHocHeader).toBeVisible();

        // Check for 'q' statistic
        const tableContent = await page.locator('#test-results-section').textContent();
        expect(tableContent).toContain('q=');

        // Check plot exists
        await expect(page.locator('#anova-plot-0')).toBeVisible();
    });

    test('should switch to Holm method', async ({ page }) => {
        await page.waitForSelector('.anova-container', { state: 'visible' });

        // Select Variables
        await selectStandardOption(page, '#factor-var', 'クラス', 'label');
        await selectVariables(page, ['数学']);

        // Switch method to Holm
        await page.selectOption('#comparison-method', 'holm');

        await page.click('#run-ind-anova-btn');

        await expect(page.locator('#analysis-results')).toBeVisible();

        // Verify Post-hoc table
        const postHocHeader = page.locator('div', { hasText: '多重比較結果 (Holm法' }).first();
        await expect(postHocHeader).toBeVisible();

        // Check for 't' statistic (Holm uses t)
        const tableContent = await page.locator('#test-results-section').textContent();
        expect(tableContent).toContain('t=');
    });
});
