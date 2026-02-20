import { test, expect } from '@playwright/test';
import { uploadFile, selectVariables } from './utils/test-helpers';

test('Wilcoxon Signed-Rank Test Verification', async ({ page }) => {
    // 1. Load the application
    await page.goto('/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

    // 2. Upload sample dataset
    await uploadFile(page, 'datasets/demo_all_analysis.csv');

    // 3. Navigate to Wilcoxon Signed-Rank Test
    const card = page.locator('.feature-card[data-analysis="wilcoxon_signed_rank"]');
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(page.locator('.wilcoxon-signed-rank-container')).toBeVisible();

    // 4. Select Dependent Variables for multiple comparison (t-tests or wilcoxon style comparison)
    // We will select "数学" and "英語"
    await selectVariables(page, ['数学', '英語']);

    // 5. Run Analysis
    await page.locator('#run-wilcoxon-test-btn').click();

    // 6. Verify Results appear
    await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });

    // Assert Integrated Table layout
    // We expect the table title to mention the integrated form or something similar
    // We'll assert that the table has Median values (Mdn) combined with the test results
    const resultsContainer = page.locator('#test-results-section');
    await expect(resultsContainer).toContainText('数学 Mdn');
    await expect(resultsContainer).toContainText('英語 Mdn');
    await expect(resultsContainer).toContainText('ウィルコクソンの符号付順位検定の結果');
});
