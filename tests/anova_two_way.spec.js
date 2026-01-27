// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

test('Two-Way Mixed ANOVA Verification', async ({ page }) => {
    // 1. Load the application
    await page.goto('http://127.0.0.1:8080/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

    // 2. Upload sample dataset
    const uploadBtn = page.locator('#main-upload-btn');
    await expect(uploadBtn).toBeEnabled({ timeout: 30000 });

    const fileInput = page.locator('#main-data-file');
    const filePath = path.join(__dirname, '../datasets/2way_anova_demo_mix.xlsx');

    // Create a promise to wait for file processing
    const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });

    await fileInput.setInputFiles(filePath);
    await previewVisiblePromise;

    // 3. Navigate to Two-Way ANOVA Analysis
    // Note: The UI might need scrolling or visibility check
    const card = page.locator('.feature-card[data-analysis="anova_two_way"]');
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(page.locator('#analysis-area')).toBeVisible();

    // 4. Select "Mixed Design"
    // Wait for the radio buttons to be available
    await expect(page.locator('input[name="anova2-type"][value="mixed"]')).toBeVisible();
    await page.locator('input[name="anova2-type"][value="mixed"]').check();

    // Verify Mixed Controls are visible
    await expect(page.locator('#mixed-controls')).toBeVisible();

    // 5. Select Between-Subjects Factor
    // Ensure options are populated
    await expect(page.locator('#mixed-between-var option')).not.toHaveCount(0);
    // Select the first available option (skipping placeholder if any)
    // createVariableSelector adds a placeholder with value=""
    // So we pick the second option (index 1) which should be a valid variable
    await page.selectOption('#mixed-between-var', { index: 1 });

    // 6. Add Pairs
    // Pair 1
    await expect(page.locator('#mixed-var-pre option')).not.toHaveCount(0);
    await page.selectOption('#mixed-var-pre', { index: 1 }); // First real option
    await page.selectOption('#mixed-var-post', { index: 2 }); // Second real option

    await page.locator('#add-mixed-pair-btn').click();

    // Verify pair added to list
    await expect(page.locator('#selected-mixed-pairs-list .selected-pair-item')).toHaveCount(1);

    // 7. Run Analysis
    // The button was created with createAnalysisButton('run-mixed-btn', ...)
    // which creates a button inside #run-mixed-btn
    await page.locator('#run-mixed-btn button').click();

    // 8. Verify Results
    await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#test-results-section')).toBeVisible();

    // Check for specific text indicating mixed ANOVA results
    await expect(page.locator('#test-results-section')).toContainText('混合計画分散分析の結果');

    // Screenshot for confirmation
    await page.screenshot({ path: 'anova_two_way_verification.png', fullPage: true });
});
