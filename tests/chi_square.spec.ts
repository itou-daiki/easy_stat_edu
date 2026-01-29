
import { test, expect } from '@playwright/test';
import { loadParamsFromConfig, navigateToFeature, uploadFile, selectOptionRobust } from './utils/test-helpers';

test.describe('Chi-Square Test Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
        await navigateToFeature(page, 'chi-square');
    });

    test('should run Chi-Square test successfully', async ({ page }) => {
        // Select categorical variables explicitly using IDs
        // Row: 部活動の有無, Col: 性別
        await selectOptionRobust(page, '#row-var', '部活動の有無');
        await selectOptionRobust(page, '#col-var', '性別');

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
});
