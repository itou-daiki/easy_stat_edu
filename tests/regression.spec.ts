
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
        await expect(page.locator('.regression-container')).toBeVisible();

        // Simple Regression uses single selects
        await selectStandardOption(page, '#dependent-var', '数学', 'label');
        await selectStandardOption(page, '#independent-var', '英語', 'label');

        await page.click('#run-simple-regression-btn');

        await expect(page.locator('#regression-results')).toBeVisible({ timeout: 30000 });
        const textContent = await page.locator('#regression-results').textContent();
        expect(textContent).toContain('回帰式');
        expect(textContent).toContain('決定係数');

        await expect(page.locator('#regression-plot')).toBeVisible();
        // Note: Plot container ID might vary, usually it's dynamic or inside results
    });

    test('should run Multiple Regression successfully', async ({ page }) => {
        await navigateToFeature(page, 'regression_multiple');

        // Dependent variable (Math) explicitly in dependent container
        const depContainer = page.locator('#dependent-var-container');
        await depContainer.locator('.multiselect-input').click();
        await depContainer.locator('.multiselect-option').filter({ hasText: '数学' }).click();

        // Independent vars (English, Science) explicitly in independent container
        const indepContainer = page.locator('#independent-vars-container');
        await indepContainer.locator('.multiselect-input').click();
        await indepContainer.locator('.multiselect-option').filter({ hasText: '英語' }).click();
        await indepContainer.locator('.multiselect-option').filter({ hasText: '理科' }).click();

        await page.click('#run-multiple-regression-btn');

        await expect(page.locator('#regression-results')).toBeVisible({ timeout: 30000 });
        const textContent = await page.locator('#regression-results').textContent();
        expect(textContent).toContain('偏回帰係数');
        expect(textContent).toContain('自由度修正済み決定係数');
    });
});
