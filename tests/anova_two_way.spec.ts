
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
    await checkRobust(page, 'input[name="anova-2-type"][value="mixed"]');
    await expect(page.locator('#mixed-controls')).toBeVisible();

    // 5. Select Between-Subjects Factor
    // Utilizing robust selection for hidden elements
    await selectStandardOption(page, '#mixed-between-var', '1', 'index');

    // 6. Add Pairs (First pair row is automatically generated)
    await selectStandardOption(page, '.pair-row .pre-select', '1', 'index');
    await selectStandardOption(page, '.pair-row .post-select', '2', 'index');

    // Click 'ペアを追加' button (it doesn't have an ID, it's inside #pair-selector-container)
    await page.locator('#pair-selector-container button.btn-secondary').click();

    // Verify pair added to list (by checking number of .pair-row elements)
    await expect(page.locator('.pair-row')).toHaveCount(2);

    // 7. Run Analysis
    await page.locator('#run-mixed-anova-btn').click();

    // 8. Verify Results
    await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#test-results-section')).toBeVisible();

    // Check for standard summary stats section title
    await expect(page.locator('#summary-stats-section')).toContainText('２要因分散分析 一括表（混合）');

    // Check for standard result table section title
    await expect(page.locator('#test-results-section')).toContainText('分散分析表');
});
