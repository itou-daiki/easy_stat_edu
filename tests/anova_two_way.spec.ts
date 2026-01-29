
import { test, expect } from '@playwright/test';
import { uploadFile, checkRobust, selectStandardOption } from './utils/test-helpers';

test('Two-Way Mixed ANOVA Verification', async ({ page }) => {
    // 1. Load the application
    await page.goto('/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

    // 2. Upload sample dataset
    // anova_two_way.spec.js used 'datasets/2way_anova_demo_mix.xlsx'
    await uploadFile(page, 'datasets/2way_anova_demo_mix.xlsx');

    // 3. Navigate to Two-Way ANOVA Analysis
    // Ensure visibility
    const card = page.locator('.feature-card[data-analysis="anova_two_way"]');
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(page.locator('#analysis-area')).toBeVisible();
    await expect(page.locator('.anova-container')).toBeVisible();

    // 4. Select "Mixed Design"
    await checkRobust(page, 'input[name="anova2-type"][value="mixed"]');
    await expect(page.locator('#mixed-controls')).toBeVisible();

    // 5. Select Between-Subjects Factor
    // Utilizing robust selection for hidden elements
    await selectStandardOption(page, '#mixed-between-var', '1', 'index');

    // 6. Add Pairs
    await selectStandardOption(page, '#mixed-var-pre', '1', 'index');
    await selectStandardOption(page, '#mixed-var-post', '2', 'index');

    await page.locator('#add-mixed-pair-btn').click();

    // Verify pair added to list
    await expect(page.locator('#selected-mixed-pairs-list .selected-pair-item')).toHaveCount(1);

    // 7. Run Analysis
    await page.locator('#run-mixed-btn button').click();

    // 8. Verify Results
    await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#test-results-section')).toBeVisible();
    await expect(page.locator('#test-results-section')).toContainText('混合計画分散分析の結果');
});
