
import { test, expect } from '@playwright/test';
import { navigateToFeature, uploadFile, selectStandardOption } from './utils/test-helpers';

test.describe('Visual Verification: Two-Way Repeated Measures ANOVA', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('Two-Way Repeated Measures ANOVA Flow', async ({ page }) => {
        await navigateToFeature(page, 'anova_two_way');

        // 1. Select Repeated Measures Mode
        await page.click('input[name="anova-2-type"][value="repeated"]');
        await expect(page.locator('#repeated-controls')).toBeVisible();

        // 2. Input Factor Definitions
        // Factor 1
        await page.fill('#rm-f1-name', 'Subject');
        await page.fill('#rm-f1-levels', 'MathSci, EngTime'); // Using arbitrary names

        // Factor 2
        await page.fill('#rm-f2-name', 'Condition');
        await page.fill('#rm-f2-levels', 'A, B');

        // 3. Generate Grid
        await page.click('#rm-generate-grid-btn');
        await expect(page.locator('#rm-grid-area table')).toBeVisible();

        // 4. Map Variables
        // Grid should be 2x2.
        // Cell MathSci-A -> 数学
        await selectStandardOption(page, '#rm-select-MathSci-A', '数学', 'label');
        // Cell MathSci-B -> 理科
        await selectStandardOption(page, '#rm-select-MathSci-B', '理科', 'label');
        // Cell EngTime-A -> 英語
        await selectStandardOption(page, '#rm-select-EngTime-A', '英語', 'label');
        // Cell EngTime-B -> 学習時間
        await selectStandardOption(page, '#rm-select-EngTime-B', '学習時間', 'label');

        // 5. Run Analysis
        await page.click('#run-rm-btn');

        // 6. Verify Results
        await expect(page.locator('#analysis-results')).toBeVisible();
        await expect(page.locator('h4:has-text("反復測定分散分析表")')).toBeVisible();

        // Check for specific columns in the standard ANOVA table
        await expect(page.locator('td:has-text("Subject (要因1)")')).toBeVisible();
        await expect(page.locator('td:has-text("Condition (要因2)")')).toBeVisible();
        await expect(page.locator('td:has-text("Error (Subject)")')).toBeVisible();

        // 7. Screenshot
        await page.screenshot({ path: 'test-results/visual_verification/anova_two_way_repeated.png', fullPage: true });

        // 8. Check Plot
        await expect(page.locator('#visualization-section .js-plotly-plot')).toBeVisible();
    });
});
