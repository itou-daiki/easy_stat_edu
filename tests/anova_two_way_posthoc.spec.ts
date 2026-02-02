
import { test, expect } from '@playwright/test';
import { loadParamsFromConfig, navigateToFeature, uploadFile, selectStandardOption, selectVariables } from './utils/test-helpers';

test.describe('ANOVA Two-Way Post-Hoc Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
        await navigateToFeature(page, 'anova_two_way');
    });

    test('should run Independent Two-Way ANOVA with Tukey post-hoc', async ({ page }) => {
        await page.waitForSelector('.anova-container', { state: 'visible' });

        // Select Independent Type (Default)

        // Select Variables
        await selectStandardOption(page, '#factor1-var', 'クラス', 'label');
        await selectStandardOption(page, '#factor2-var', '性別', 'label');
        await selectVariables(page, ['数学']);

        // Check default method is Tukey
        await expect(page.locator('#two-way-comparison-method')).toHaveValue('tukey');

        await page.click('#run-ind-anova-btn');

        await expect(page.locator('#analysis-results')).toBeVisible();

        // Verify Analysis Results sections
        await expect(page.locator('#test-results-section')).toContainText('分散分析表: 数学');

        // Check for 'q' statistic in Interpretation or Table?
        // Note: Two-way implementation currently doesn't output a separate post-hoc table for simple main effects,
        // but it does display brackets on the plot and mention results in interpretation.
        // We should update the code to display a table of simple main effects if desired, but
        // for now let's check interpretation text mentioning the method.

        const interpretation = page.locator('#interpretation-section');
        await expect(interpretation).toContainText('Tukey-Kramer法');

        // Check Plotly graph exists
        await expect(page.locator('#anova-plot-0')).toBeVisible();
    });

    test('should run Independent Two-Way ANOVA with Holm post-hoc', async ({ page }) => {
        await page.waitForSelector('.anova-container', { state: 'visible' });

        // Select Variables
        await selectStandardOption(page, '#factor1-var', 'クラス', 'label');
        await selectStandardOption(page, '#factor2-var', '性別', 'label');
        await selectVariables(page, ['数学']);

        // Switch to Holm
        await page.selectOption('#two-way-comparison-method', 'holm');

        await page.click('#run-ind-anova-btn');

        await expect(page.locator('#analysis-results')).toBeVisible();

        const interpretation = page.locator('#interpretation-section');
        await expect(interpretation).toContainText('Holm法');
    });
});
