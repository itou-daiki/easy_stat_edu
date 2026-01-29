
import { test, expect } from '@playwright/test';
import { loadParamsFromConfig, navigateToFeature, uploadFile, selectVariables } from './utils/test-helpers';

test.describe('PCA Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
        await navigateToFeature(page, 'pca');
    });

    test('should run PCA successfully', async ({ page }) => {
        // Select numeric variables
        // PCA uses a custom multi-select with ID 'pca-vars'
        await selectVariables(page, ['数学', '英語', '理科', '学習時間']);

        // Run analysis
        await page.click('#run-pca-btn');

        // Check for results
        // Use a more generous timeout as PCA might take a moment
        await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 10000 });

        // Verify key output sections
        const textContent = await page.locator('#analysis-results').textContent();
        expect(textContent).toContain('寄与率'); // "Contribution ratio"

        // Check for plot visibility
        await expect(page.locator('#scree-plot')).toBeVisible();
        await expect(page.locator('#biplot')).toBeVisible();
    });
});
