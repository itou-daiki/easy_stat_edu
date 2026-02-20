import { test, expect } from '@playwright/test';
import { uploadFile, selectStandardOption, selectVariables } from './utils/test-helpers';

test('Kruskal-Wallis Test Verification', async ({ page }) => {
    // 1. Load the application
    await page.goto('/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

    // 2. Upload sample dataset
    await uploadFile(page, 'datasets/demo_all_analysis.csv');

    // 3. Navigate to Kruskal-Wallis Analysis
    const card = page.locator('.feature-card[data-analysis="kruskal_wallis"]');
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(page.locator('.kruskal-wallis-container')).toBeVisible();

    // 4. Select Group Variable
    await selectStandardOption(page, '#group-var', 'クラス', 'label');

    // 5. Select Dependent Variable
    await selectVariables(page, ['数学']);

    // 6. Run Analysis
    await page.locator('#run-kw-test-btn').click();

    // 7. Verify Results
    await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });

    // Assert Integrated Table (this will fail initially because kruskal_wallis.js separates summary and test results)
    await expect(page.locator('#test-results-section')).toContainText('Kruskal-Wallis検定表');
});
