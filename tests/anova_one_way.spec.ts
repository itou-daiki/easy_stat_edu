
import { test, expect } from '@playwright/test';
import { loadParamsFromConfig, navigateToFeature, uploadFile, selectOptionRobust, selectVariables } from './utils/test-helpers';

test.describe('ANOVA One-Way Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
        await navigateToFeature(page, 'anova_one_way');
    });

    test('should run ANOVA One-Way successfully', async ({ page }) => {
        // Factor: 学年 (Single Select), Dependent: 数学 (Multi Select)

        // Use robust selector for Factor (Single)
        await selectOptionRobust(page, '#factor-var', '学年', 'label');

        // Use selectVariables for Dependent (Multi - Custom)
        await selectVariables(page, ['数学']);
        // Note: selectVariables handles standard or custom multiselects by searching for input/option.
        // The ID of the select is 'dependent-var', but selectVariables takes variable names.

        await page.click('#run-ind-anova-btn');

        await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 10000 });
        const textContent = await page.locator('#analysis-results').textContent();
        expect(textContent).toContain('平均値の差の検定');
        expect(textContent).toContain('F値');

        // Check plots
        await expect(page.locator('#anova-plot-0')).toBeVisible();
    });
});
